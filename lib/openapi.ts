import { ABSOLUTE_MAX_UPLOAD_BYTES, packages, renewalOffer } from "./packages";
import { PATH_USD } from "./pathusd";

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Bounded file drop",
      version: "1.0.0",
      description: [
        "Pay for a file envelope before any bytes are stored. Hard limits. No unpaid overages.",
        "Discovery: GET /openapi.json then GET /api/packages. Follow 402 payment challenges and the URLs in JSON responses.",
        `Payment is HTTP 402 in pathUSD on Tempo testnet (chain 42431, currency ${PATH_USD}). Tempo Wallet credits cannot pay this API.`,
        "Protocol: measure exact file bytes → POST /api/files → pay 402 if returned → PUT upload.url with the returned upload.headers → POST complete_url → share download_url.",
        `Uploads above 3 MB have no package. Files above ${ABSOLUTE_MAX_UPLOAD_BYTES} bytes are rejected. Content-Length on the PUT must equal declared size_bytes. A 409 on complete means the object exceeded the envelope and was deleted. Do not retry a larger upload.`,
        "Downloads are metered. 410 means the file is gone (expiry or 100 downloads). Another 402 means pay $0.05 to add 1 GB of transfer; that does not extend expiry or download count.",
      ].join(" "),
    },
    servers: [{ url: "/", description: "This origin" }],
    tags: [
      { name: "discovery" },
      { name: "files" },
      { name: "downloads" },
    ],
    paths: {
      "/api/packages": {
        get: {
          tags: ["discovery"],
          summary: "List purchase tiers",
          operationId: "listPackages",
          responses: {
            "200": {
              description: "Current offers and the egress renewal price.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PackageCatalog" },
                },
              },
            },
          },
        },
      },
      "/api/files": {
        post: {
          tags: ["files"],
          summary: "Declare size and buy an upload envelope",
          operationId: "createFile",
          description:
            "Unpaid requests return 402 with an offer. After payment, the body contains upload, complete_url, and download_url. PUT the file to upload.url next.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateFileRequest" },
              },
            },
          },
          "x-payment-info": {
            network: "tempo-testnet",
            chainId: 42431,
            currency: "pathUSD",
            currencyAddress: PATH_USD,
            creditsAccepted: false,
            offers: packages.map((pkg) => ({
              amount: pkg.price,
              currency: "pathUSD",
              description: pkg.description,
              retention: pkg.retention,
              max_upload_bytes: pkg.max_upload_bytes,
              max_egress_bytes: pkg.max_egress_bytes,
              max_downloads: pkg.max_downloads,
            })),
          },
          responses: {
            "200": {
              description: "Envelope purchased. Follow upload, then complete_url.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreateFileResponse" },
                },
              },
            },
            "400": {
              description:
                "Invalid request, no package covers this size, or file is larger than 50 MB.",
            },
            "402": {
              description:
                "Payment required. Pay the challenge in pathUSD, then retry this same request.",
              content: {
                "application/problem+json": {
                  schema: { $ref: "#/components/schemas/PaymentChallenge" },
                },
              },
            },
          },
        },
      },
      "/api/files/{id}": {
        get: {
          tags: ["files"],
          summary: "File status and envelope",
          operationId: "getFile",
          parameters: [{ $ref: "#/components/parameters/FileId" }],
          responses: {
            "200": {
              description: "Current status and remaining envelope.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/FileStatus" },
                },
              },
            },
            "410": { description: "File is gone or quarantined." },
          },
        },
      },
      "/api/files/{id}/complete": {
        post: {
          tags: ["files"],
          summary: "Verify object size and publish the download URL",
          operationId: "completeFile",
          description:
            "HEAD-checks the uploaded object. Publishes only when actual size ≤ declared size_bytes ≤ package max. Otherwise deletes the object and returns 409.",
          parameters: [{ $ref: "#/components/parameters/FileId" }],
          responses: {
            "200": {
              description: "Published. Share download_url from the create response or GET /f/{id}.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CompleteFileResponse" },
                },
              },
            },
            "409": {
              description:
                "Upload missing, or object exceeded the purchased size envelope and was deleted.",
            },
            "410": { description: "Upload is no longer available." },
          },
        },
      },
      "/f/{id}": {
        get: {
          tags: ["downloads"],
          summary: "Download a published file",
          operationId: "downloadFile",
          description:
            "Meters one download and the file's byte size against the envelope before serving. 410 when expired or download count is exhausted. 402 when transfer is exhausted.",
          parameters: [{ $ref: "#/components/parameters/FileId" }],
          "x-payment-info": {
            network: "tempo-testnet",
            chainId: 42431,
            currency: "pathUSD",
            creditsAccepted: false,
            offers: [
              {
                amount: renewalOffer.price,
                currency: "pathUSD",
                extra_egress_bytes: renewalOffer.extra_egress_bytes,
                description: renewalOffer.description,
              },
            ],
          },
          responses: {
            "200": { description: "File bytes. Content-Disposition is an attachment." },
            "402": {
              description:
                "Transfer allowance exhausted. Pay $0.05 to add 1 GB, then retry. Does not extend expiry or downloads.",
            },
            "404": { description: "Not published yet." },
            "410": { description: "Expired, download limit reached, or deleted." },
          },
        },
        post: {
          tags: ["downloads"],
          summary: "Buy another 1 GB of transfer",
          operationId: "renewEgress",
          parameters: [{ $ref: "#/components/parameters/FileId" }],
          "x-payment-info": {
            network: "tempo-testnet",
            chainId: 42431,
            currency: "pathUSD",
            creditsAccepted: false,
            offers: [
              {
                amount: renewalOffer.price,
                currency: "pathUSD",
                extra_egress_bytes: renewalOffer.extra_egress_bytes,
                description: renewalOffer.description,
              },
            ],
          },
          responses: {
            "200": { description: "Envelope updated with another 1 GB of transfer." },
            "402": { description: "Payment required for the renewal offer." },
            "410": { description: "File is gone." },
          },
        },
      },
    },
    components: {
      parameters: {
        FileId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      },
      schemas: {
        CreateFileRequest: {
          type: "object",
          required: ["filename", "size_bytes"],
          properties: {
            filename: { type: "string", examples: ["report.pdf"] },
            size_bytes: {
              type: "integer",
              minimum: 1,
              maximum: 3 * 1024 * 1024,
              description:
                "Exact byte size of the file you will PUT. Must match Content-Length on upload.url.",
            },
            retention: {
              type: "string",
              enum: ["24h", "7d"],
              default: "24h",
              description: "24h costs $0.01. 7d costs $0.05.",
            },
          },
        },
        ConstrainedUpload: {
          type: "object",
          required: ["method", "url", "headers"],
          properties: {
            method: { type: "string", const: "PUT" },
            url: {
              type: "string",
              format: "uri",
              description:
                "Presigned Amazon S3 PUT. Send upload.headers. Content-Length must equal size_bytes.",
            },
            headers: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Required request headers for the PUT, including content-length and content-type.",
            },
          },
        },
        CreateFileResponse: {
          type: "object",
          required: ["file_id", "status", "upload", "complete_url", "download_url", "envelope"],
          properties: {
            file_id: { type: "string", format: "uuid" },
            status: { type: "string", examples: ["pending_upload"] },
            upload: { $ref: "#/components/schemas/ConstrainedUpload" },
            complete_url: { type: "string", format: "uri" },
            download_url: { type: "string", format: "uri" },
            envelope: { $ref: "#/components/schemas/Envelope" },
            offer: { type: "object" },
          },
        },
        CompleteFileResponse: {
          type: "object",
          properties: {
            file_id: { type: "string", format: "uuid" },
            status: { type: "string", examples: ["published"] },
            envelope: { $ref: "#/components/schemas/Envelope" },
          },
        },
        FileStatus: {
          type: "object",
          properties: {
            file_id: { type: "string", format: "uuid" },
            filename: { type: "string" },
            status: { type: "string" },
            envelope: { $ref: "#/components/schemas/Envelope" },
          },
        },
        Envelope: {
          type: "object",
          properties: {
            max_upload_bytes: { type: "integer" },
            max_egress_bytes: { type: "integer" },
            max_downloads: { type: "integer" },
            expires_at: { type: "string", format: "date-time" },
          },
        },
        PaymentChallenge: {
          type: "object",
          properties: {
            title: { type: "string" },
            status: { type: "integer", const: 402 },
            offer: { type: "object" },
          },
        },
        PackageCatalog: {
          type: "object",
          properties: {
            absolute_max_upload_bytes: { type: "integer", const: ABSOLUTE_MAX_UPLOAD_BYTES },
            packages: {
              type: "array",
              items: { $ref: "#/components/schemas/Package" },
            },
            renewal: { $ref: "#/components/schemas/Renewal" },
          },
        },
        Package: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["day", "week"] },
            price: { type: "string" },
            retention: { type: "string", enum: ["24h", "7d"] },
            max_upload_bytes: { type: "integer" },
            max_egress_bytes: { type: "integer" },
            max_downloads: { type: "integer" },
            description: { type: "string" },
          },
        },
        Renewal: {
          type: "object",
          properties: {
            price: { type: "string", const: renewalOffer.price },
            extra_egress_bytes: { type: "integer", const: renewalOffer.extra_egress_bytes },
            description: { type: "string" },
          },
        },
      },
    },
  };
}
