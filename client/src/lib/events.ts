export const triggerVaultUpdate = () => {
  // Trigger storage event
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'documentVault',
    newValue: localStorage.getItem('documentVault')
  }));

  // Trigger custom event
  document.dispatchEvent(new CustomEvent('vaultUpdated'));

  // Update timestamp
  localStorage.setItem('vaultLastUpdated', new Date().toISOString());
}; 