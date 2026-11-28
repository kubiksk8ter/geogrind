import type { IconProps } from "./iconTypes";

// Third-party marks with their shapes unaltered, in one colour (currentColor); both brands allow
// a black or white mark. Hidden from AT, the link around them carries the name.

/** The GitHub mark (Invertocat), path of `mark-github-24` from GitHub's Octicons (MIT). */
export function GitHubMark({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943" />
    </svg>
  );
}

/**
 * The LinkedIn [in] mark, a vector trace of the official "InBug-Black" artwork from
 * brand.linkedin.com (the ® sign left out at icon size); the letters are cut out.
 */
export function LinkedInMark({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0.8 0.8 777.5 777.5"
      className={className}
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M56 .8h667.1a55.2 55.2 0 0 1 55.2 55.2v667.1a55.2 55.2 0 0 1-55.2 55.2H56A55.2 55.2 0 0 1 .8 723.1V56A55.2 55.2 0 0 1 56 .8ZM107.2 174.35a66.8 66.8 0 1 0 133.6 0a66.8 66.8 0 1 0-133.6 0ZM116.2 292.2h115.3v371.3H116.2ZM304.2 292.2h110.6V343c4.3-2.6 31.2-60 109.2-60 79 0 140 31 140 167v213.5H549V480c0-31 1.5-96.6-60.5-96.6-70 0-69.3 69.6-69.3 96.6v183.5h-115Z"
      />
    </svg>
  );
}
