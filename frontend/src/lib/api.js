const API_BASE = 'http://localhost:8800';

export const apiRequest = async (path, options = {}) => {
	const response = await fetch(`${API_BASE}${path}`, {
		headers: { 'Content-Type': 'application/json' },
		...options,
	});

	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		const message = data?.message || '通信に失敗しました';
		throw new Error(message);
	}
	return data;
};
