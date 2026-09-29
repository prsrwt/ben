/** Joins class names, skipping false, null and undefined: cn('a', isOn && 'b'). */
export function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(' ')
}
