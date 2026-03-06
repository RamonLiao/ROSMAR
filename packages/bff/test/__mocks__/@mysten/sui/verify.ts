export const verifyPersonalMessageSignature = jest.fn().mockResolvedValue({
  toSuiAddress: () => 'mock-sui-address',
});
