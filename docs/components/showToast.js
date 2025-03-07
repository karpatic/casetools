const showToast = (message) => {
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
	toast.className = 'toast align-items-center text-bg-primary border-0';
	toast.role = 'alert';
	toast.ariaLive = 'assertive';
	toast.ariaAtomic = 'true';
	toast.style.marginBottom = '0.5rem';
	toast.innerHTML = `<div class="d-flex">
		<div class="toast-body">${message}</div>
		<button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
	</div>`;
	container.appendChild(toast);
	const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
	bsToast.show();
	setTimeout(() => { toast.remove(); }, 3500);
};

export default showToast;