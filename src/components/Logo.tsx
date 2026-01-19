import relayIcon from '@/assets/relay-favicon.svg'
import relayLogo from '@/assets/relay-logo.svg'

interface LogoProps {
    variant?: 'icon' | 'full'
    className?: string
}

export function Logo({ variant = 'icon', className = '' }: LogoProps) {
    const src = variant === 'icon' ? relayIcon : relayLogo
    const defaultClass = variant === 'icon' ? 'h-6 w-6' : 'h-8'

    return (
        <img
            src={src}
            alt="Relay"
            className={className || defaultClass}
        />
    )
}
