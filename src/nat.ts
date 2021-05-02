export enum NatType {
  OpenInternet,
  EndpointIndependentMapping,
  EndpointDependentMapping
}

export const discover = async () => {
  // TODO: Missing implementation
  return process.env.NAT ? NatType.OpenInternet : NatType.EndpointDependentMapping;
}
