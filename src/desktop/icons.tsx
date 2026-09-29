// The PostHog icons Ben uses, copied from @posthog/icons (MIT, see LICENSE-POSTHOG) so the look is
// identical without shipping the whole package (about 260 KB of JavaScript for these four). The
// wrapper matches PostHog's BaseIcon and `.LemonIcon` sizing: a 24x24 filled glyph, 1em wide.
// Size with a class, e.g. className="size-4".

import { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function BaseIcon({ className, children, ...props }: IconProps): JSX.Element {
    return (
        <svg
            className={className ? `LemonIcon ${className}` : 'LemonIcon'}
            width="1em"
            height="1em"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden
            {...props}
        >
            {children}
        </svg>
    )
}

export const IconSearch = (props: IconProps): JSX.Element => (
    <BaseIcon {...props}>
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM3 11a8 8 0 1 1 14.162 5.102l3.618 3.618a.75.75 0 1 1-1.06 1.06l-3.618-3.618A8 8 0 0 1 3 11Z"
        />
    </BaseIcon>
)

export const IconBrightness = (props: IconProps): JSX.Element => (
    <BaseIcon {...props}>
        <g clipPath="url(#icon-brightness-clip)">
            <path d="M6.534 12a5.465 5.465 0 1 0 10.93 0 5.465 5.465 0 0 0-10.93 0Zm5.518-4.034a4.085 4.085 0 0 1 3.538 6.13 4.086 4.086 0 0 1-3.538 2.042V7.966Zm.348-2.554V2.96a.46.46 0 1 0-.918 0v2.452a.46.46 0 0 0 .918 0Zm6.274.484a.46.46 0 0 0-.65-.65l-1.727 1.733a.46.46 0 0 0 .65.65l1.727-1.733Zm-.086 6.504h2.451a.46.46 0 1 0 0-.918h-2.451a.46.46 0 0 0 0 .918Zm-2.218 3.897a.458.458 0 0 0 0 .65l1.734 1.735a.462.462 0 0 0 .785-.325.457.457 0 0 0-.136-.325l-1.733-1.735a.46.46 0 0 0-.65 0Zm-4.77 2.291v2.452a.46.46 0 1 0 .918 0v-2.452a.46.46 0 0 0-.918 0Zm-6.282-.484a.461.461 0 0 0 .325.784.455.455 0 0 0 .325-.134l1.734-1.735v.001a.46.46 0 0 0-.65-.65l-1.734 1.734ZM2.5 12.052a.46.46 0 0 0 .46.458h2.45a.46.46 0 0 0 0-.918H2.96a.462.462 0 0 0-.46.46Zm5.13-4.35a.458.458 0 0 0 0-.65L5.894 5.318a.46.46 0 0 0-.65.65L6.98 7.702c.18.178.47.178.65 0Z" />
        </g>
        <defs>
            <clipPath id="icon-brightness-clip">
                <path transform="translate(2 2)" d="M0 0h20v20H0z" />
            </clipPath>
        </defs>
    </BaseIcon>
)

export const IconPalette = (props: IconProps): JSX.Element => (
    <BaseIcon {...props}>
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 4c-4.734 0-8.5 3.62-8.5 8s3.766 8 8.5 8c.107 0 .193-.004.262-.01a6.097 6.097 0 0 0-.216-.425l-.103-.186c-.22-.396-.502-.906-.679-1.43-.211-.627-.317-1.401.065-2.166.607-1.217 1.772-1.475 2.826-1.46.529.008 1.085.083 1.617.167.183.028.362.058.537.087.352.058.691.114 1.034.16 1.055.137 1.808.108 2.298-.198.416-.26.859-.872.859-2.539 0-4.38-3.766-8-8.5-8ZM2 12c0-5.285 4.517-9.5 10-9.5S22 6.715 22 12c0 1.888-.506 3.152-1.566 3.812-.985.615-2.234.548-3.284.412a33.19 33.19 0 0 1-1.12-.172 65.03 65.03 0 0 0-.492-.08c-.52-.082-.988-.143-1.405-.149-.835-.012-1.24.186-1.462.63-.132.264-.131.583.015 1.018.129.383.335.757.557 1.159l.12.216c.123.226.254.476.345.716.085.226.18.555.108.904-.086.42-.373.705-.727.858-.312.135-.69.176-1.089.176-5.483 0-10-4.215-10-9.5Zm8.25-4.75a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm-2 .5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm7 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm-2 .5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm-6 2.25a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm-2 .5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
        />
    </BaseIcon>
)

export const IconLaptop = (props: IconProps): JSX.Element => (
    <BaseIcon {...props}>
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3 5.75A2.75 2.75 0 0 1 5.75 3h12.5A2.75 2.75 0 0 1 21 5.75V16h1.25a.75.75 0 0 1 .75.75v1.5A2.75 2.75 0 0 1 20.25 21H3.75A2.75 2.75 0 0 1 1 18.25v-1.5a.75.75 0 0 1 .75-.75H3V5.75ZM4.5 16h15V5.75c0-.69-.56-1.25-1.25-1.25H5.75c-.69 0-1.25.56-1.25 1.25V16Zm-2 1.5v.75c0 .69.56 1.25 1.25 1.25h16.5c.69 0 1.25-.56 1.25-1.25v-.75h-19Z"
        />
    </BaseIcon>
)
