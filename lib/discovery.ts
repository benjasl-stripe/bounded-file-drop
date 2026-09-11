export const OPENAPI_PATH = "/openapi.json";
export const PACKAGES_PATH = "/api/packages";
export const LLMS_PATH = "/llms.txt";

export const SERVICE_DESC_LINKS = [
  `<${OPENAPI_PATH}>; rel="service-desc"; type="application/openapi+json"`,
  `<${LLMS_PATH}>; rel="describedby"; type="text/plain"`,
  `<${PACKAGES_PATH}>; rel="collection"`,
  `</>; rel="service-doc"`,
].join(", ");
