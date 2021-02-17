export const isProd = (): boolean => {
    return process.env.NODE_ENV === 'production';
}