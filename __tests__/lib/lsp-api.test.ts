import { toLspError, LspErrorCode } from '../../lib/lsp-api';

describe('LSPS1 Response Mapping', () => {
  describe('toLspError', () => {
    it('should map fetch errors to URL_NOT_FOUND', () => {
      const networkError = new Error('fetch failed');
      const result = toLspError(networkError);
      
      expect(result.code).toBe(LspErrorCode.URL_NOT_FOUND);
      expect(result.message).toContain('fetch failed');
    });

    it('should map timeout errors correctly', () => {
      const timeoutError = new Error('timeout');
      const result = toLspError(timeoutError);
      
      expect(result.code).toBe(LspErrorCode.TIMEOUT);
      expect(result.message).toContain('timeout');
    });

    it('should map HTTP 404 errors correctly', () => {
      const mockResponse = { status: 404 } as Response;
      const result = toLspError(null, mockResponse);
      
      expect(result.code).toBe(LspErrorCode.URL_NOT_FOUND);
      expect(result.message).toContain('endpoint not found');
    });

    it('should map HTTP 500 errors correctly', () => {
      const mockResponse = { status: 500 } as Response;
      const result = toLspError(null, mockResponse);
      
      expect(result.code).toBe(LspErrorCode.BAD_STATUS);
      expect(result.message).toContain('HTTP 500');
    });

    it('should map unknown errors to UNKNOWN', () => {
      const unknownError = { weird: 'error' };
      const result = toLspError(unknownError);
      
      expect(result.code).toBe(LspErrorCode.UNKNOWN);
      expect(result.message).toContain('Unknown error');
    });

    it('should handle string errors', () => {
      const stringError = 'Something went wrong';
      const result = toLspError(stringError);
      
      expect(result.code).toBe(LspErrorCode.UNKNOWN);
      expect(result.message).toBe('Unknown error');
    });
  });
});
