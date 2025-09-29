interface ProModeAccess {
  hasAccess: boolean;
  expiresAt: number;
  paid: boolean;
}

const PRO_MODE_KEY = 'alby-lsp-pro-mode-access';
const PRO_MODE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export const ProModeManager = {
  /**
   * Check if user has valid Pro Mode access
   */
  hasProModeAccess(): boolean {
    try {
      const stored = localStorage.getItem(PRO_MODE_KEY);
      if (!stored) return false;

      const access: ProModeAccess = JSON.parse(stored);
      
      // Check if access is expired
      if (Date.now() > access.expiresAt) {
        this.clearProModeAccess();
        return false;
      }

      return access.hasAccess && access.paid;
    } catch (error) {
      console.error('Error checking Pro Mode access:', error);
      return false;
    }
  },

  /**
   * Grant Pro Mode access after successful payment
   */
  grantProModeAccess(): void {
    const access: ProModeAccess = {
      hasAccess: true,
      expiresAt: Date.now() + PRO_MODE_DURATION,
      paid: true
    };

    localStorage.setItem(PRO_MODE_KEY, JSON.stringify(access));
  },

  /**
   * Clear Pro Mode access (logout, expired, etc.)
   */
  clearProModeAccess(): void {
    localStorage.removeItem(PRO_MODE_KEY);
  },

  /**
   * Get remaining days of Pro Mode access
   */
  getRemainingDays(): number {
    try {
      const stored = localStorage.getItem(PRO_MODE_KEY);
      if (!stored) return 0;

      const access: ProModeAccess = JSON.parse(stored);
      const remainingMs = access.expiresAt - Date.now();
      
      if (remainingMs <= 0) return 0;
      
      return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    } catch (error) {
      console.error('Error getting remaining days:', error);
      return 0;
    }
  },

  /**
   * Check if Pro Mode access is expiring soon (within 3 days)
   */
  isExpiringSoon(): boolean {
    return this.getRemainingDays() <= 3 && this.getRemainingDays() > 0;
  }
};
