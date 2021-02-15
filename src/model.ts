export interface Config {
    network: {
        peer: {
            id: string;
            privKey: string;
            pubKey: string;
        };
        bootstrap: string[];
        port: number;
    }
    gateway: {
        port: number;
    };
}