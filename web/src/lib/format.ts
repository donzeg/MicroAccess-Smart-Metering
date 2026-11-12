export const formatDateTime = (value: string | null): string => {
	if (!value) return 'Not available';
	return new Intl.DateTimeFormat('en-NG', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Africa/Lagos'
	}).format(new Date(value));
};

export const formatNumber = (value: number | null, maximumFractionDigits = 2): string =>
	value === null ? 'Not provided' : new Intl.NumberFormat('en-NG', { maximumFractionDigits }).format(value);

export const formatNaira = (value: number | null): string =>
	value === null
		? 'Not provided'
		: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value);
