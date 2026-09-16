/**
 * SkillSyncPro - Modal Manager Module
 * Provides centralized modal dialog management for #modal-container.
 * Supports openModal, closeModal, getActiveModalId, focus trapping,
 * backdrop click-to-close, keyboard shortcuts (Escape), and custom events.
 */

let currentActiveModalId = null;
let currentOptions = {};
let previousActiveElement = null;
let isInitialized = false;

/**
 * Normalizes modal ID by stripping leading hash if present.
 * @param {string} id
 * @returns {string}
 */
function normalizeId(id) {
  if (!id) return '';
  return id.startsWith('#') ? id.slice(1) : id;
}

/**
 * Finds all focusable elements within a given container
 * @param {HTMLElement} container
 * @returns {NodeList|Array}
 */
function getFocusableElements(container) {
  if (!container) return [];
  return container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
}

/**
 * Initialize event listeners for backdrop clicks, close buttons, and keyboard navigation.
 */
function initModalListeners() {
  if (isInitialized) return;

  const container = document.getElementById('modal-container');
  if (!container) return;

  isInitialized = true;

  // Backdrop and data-modal-close click delegation
  container.addEventListener('click', (event) => {
    // Check if clicked on a close button or its descendant
    const closeBtn = event.target.closest('[data-modal-close]');
    if (closeBtn) {
      event.preventDefault();
      closeModal('cancel');
      return;
    }

    // Check if clicked directly on the backdrop container
    if (event.target === container) {
      if (currentOptions.backdropClosable !== false) {
        closeModal('backdrop');
      }
    }
  });

  // Global keydown handler for Escape and Tab focus cycling
  window.addEventListener('keydown', (event) => {
    if (!currentActiveModalId) return;

    // Handle Escape key
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal('escape');
      return;
    }

    // Handle Tab focus trap inside open modal
    if (event.key === 'Tab') {
      const activeModal = document.getElementById(currentActiveModalId);
      if (!activeModal) return;

      const focusables = Array.from(getFocusableElements(activeModal)).filter(
        el => el.offsetParent !== null // only visible elements
      );

      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement || !activeModal.contains(document.activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement || !activeModal.contains(document.activeElement)) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  });
}

/**
 * Opens a modal dialog by ID.
 *
 * @param {string} modalId - Target modal DOM ID (with or without '#', e.g. 'modal-confirm')
 * @param {object} [options={}]
 * @param {Function} [options.onConfirm] - Callback invoked when confirmed
 * @param {Function} [options.onCancel] - Callback invoked when canceled
 * @param {Function} [options.onClose] - Callback invoked when modal is closed
 * @param {boolean} [options.backdropClosable=true] - Whether clicking the backdrop closes the modal
 * @returns {boolean} whether the modal opened successfully
 */
export function openModal(modalId, options = {}) {
  const normalizedId = normalizeId(modalId);
  const container = document.getElementById('modal-container');
  if (!container) {
    console.error(`modalManager: #modal-container not found in DOM`);
    return false;
  }

  const targetModal = document.getElementById(normalizedId);
  if (!targetModal) {
    console.error(`modalManager: Modal element #${normalizedId} not found in DOM`);
    return false;
  }

  // Ensure global listeners are bound
  initModalListeners();

  // Hide all existing child modals inside container
  const childModals = container.querySelectorAll('.modal-dialog, [role="dialog"]');
  childModals.forEach((m) => {
    m.classList.add('hidden');
  });

  // Save current active element to restore focus on close (only if no modal was currently open)
  if (!currentActiveModalId) {
    previousActiveElement = document.activeElement;
  }

  // Store options and state
  currentActiveModalId = normalizedId;
  currentOptions = {
    backdropClosable: true,
    ...options
  };

  // Show target modal and container
  targetModal.classList.remove('hidden');
  container.classList.remove('hidden');
  container.classList.add('flex');

  // Prevent background scrolling
  document.body.classList.add('overflow-hidden');

  // Focus the first action element or main button
  setTimeout(() => {
    const focusables = getFocusableElements(targetModal);
    if (focusables.length > 0) {
      // Prefer primary action button if present, otherwise first focusable
      const primaryBtn = targetModal.querySelector('button[type="submit"], button.bg-primary, button[class*="gradient"]') || focusables[0];
      primaryBtn.focus();
    }
  }, 50);

  // Dispatch custom event
  document.dispatchEvent(
    new CustomEvent('skillsync:modal-opened', {
      bubbles: true,
      detail: { modalId: normalizedId }
    })
  );

  return true;
}

/**
 * Closes the currently active modal dialog.
 *
 * @param {string|null} [result=null] - Reason or result of closing ('confirm', 'cancel', 'backdrop', 'escape')
 */
export function closeModal(result = null) {
  if (!currentActiveModalId) return;

  const container = document.getElementById('modal-container');
  const closedId = currentActiveModalId;
  const options = currentOptions;

  // Hide container and all child modals
  if (container) {
    container.classList.add('hidden');
    container.classList.remove('flex');
    const childModals = container.querySelectorAll('.modal-dialog, [role="dialog"]');
    childModals.forEach((m) => {
      m.classList.add('hidden');
    });
  }

  // Restore background scrolling
  document.body.classList.remove('overflow-hidden');

  // Restore focus to previous element
  if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
    try {
      previousActiveElement.focus();
    } catch (err) {
      console.warn('modalManager: Failed to restore focus:', err);
    }
  }

  // Execute callbacks
  if (result === 'confirm' && typeof options.onConfirm === 'function') {
    options.onConfirm();
  } else if (result === 'cancel' && typeof options.onCancel === 'function') {
    options.onCancel();
  }

  if (typeof options.onClose === 'function') {
    options.onClose(result);
  }

  // Reset state
  currentActiveModalId = null;
  currentOptions = {};
  previousActiveElement = null;

  // Dispatch custom event
  document.dispatchEvent(
    new CustomEvent('skillsync:modal-closed', {
      bubbles: true,
      detail: { modalId: closedId, result }
    })
  );
}

/**
 * Returns ID of currently active modal or null.
 * @returns {string|null}
 */
export function getActiveModalId() {
  return currentActiveModalId;
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModalListeners);
  } else {
    initModalListeners();
  }
}

// Expose on window object for non-module scripts and browser console debugging
if (typeof window !== 'undefined') {
  window.modalManager = {
    openModal,
    closeModal,
    getActiveModalId
  };
}

export default {
  openModal,
  closeModal,
  getActiveModalId
};
