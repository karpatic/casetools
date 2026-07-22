const showToast = (message, options = {}) => {
	const { variant = 'primary', delay = 3000 } = options;
	// Create a toast container if it does not exist
	let container = document.getElementById('toast-container');
	if (!container) {
		container = document.createElement('div');
		container.id = 'toast-container';
		container.style.position = 'fixed';
		container.style.top = '1rem';
		container.style.right = '1rem';
		container.style.zIndex = 9999;
		document.body.appendChild(container);
	}
	const toast = document.createElement('div');
	toast.className = `toast align-items-center text-bg-${variant} border-0`;
	toast.role = 'alert';
	toast.setAttribute('aria-live', 'assertive');
	toast.setAttribute('aria-atomic', 'true');
	toast.style.marginBottom = '0.5rem';
	const content = document.createElement('div');
	content.className = 'd-flex';
	const body = document.createElement('div');
	body.className = 'toast-body';
	body.textContent = message;
	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className = 'btn-close me-2 m-auto';
	closeButton.setAttribute('data-bs-dismiss', 'toast');
	closeButton.setAttribute('aria-label', 'Close');
	content.appendChild(body);
	content.appendChild(closeButton);
	toast.appendChild(content);
	container.appendChild(toast);
	const bsToast = new bootstrap.Toast(toast, { delay });
	bsToast.show();
	setTimeout(() => { toast.remove(); }, delay + 500);
};

export default showToast;
