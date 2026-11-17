export type ReportExportValue = string | number | boolean | null | undefined;

export interface ReportExportSummary {
	label: string;
	value: string;
	detail?: string;
}

export interface ReportExportDocument {
	fileName: string;
	title: string;
	reportingWindow: string;
	scope: string;
	generatedAt: string;
	source: string;
	summary: ReportExportSummary[];
	headers: string[];
	rows: ReportExportValue[][];
	notes?: string[];
}

const BRAND = {
	navy: [0, 43, 77] as [number, number, number],
	blue: [16, 79, 130] as [number, number, number],
	cyan: [35, 203, 214] as [number, number, number],
	sky: [90, 181, 226] as [number, number, number],
	green: [21, 183, 68] as [number, number, number],
	slate: [67, 89, 110] as [number, number, number],
	pale: [238, 246, 250] as [number, number, number],
	line: [209, 224, 232] as [number, number, number]
};

let logoDataUrl: Promise<string> | null = null;

const fetchLogoDataUrl = (): Promise<string> => {
	if (logoDataUrl) return logoDataUrl;
	logoDataUrl = fetch('/brand/microaccess-logo.png')
		.then((response) => {
			if (!response.ok) throw new Error('The MicroAccess report logo could not be loaded.');
			return response.blob();
		})
		.then((blob) => new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error ?? new Error('The report logo could not be read.'));
			reader.readAsDataURL(blob);
		}));
	return logoDataUrl;
};

const safeFileName = (value: string): string => value
	.trim()
	.toLowerCase()
	.replace(/[^a-z0-9]+/g, '-')
	.replace(/^-+|-+$/g, '') || 'microaccess-report';

const displayValue = (value: ReportExportValue): string => {
	if (value === null || value === undefined || value === '') return 'Not provided';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	return String(value);
};

const pdfValue = (value: ReportExportValue, header: string): string => {
	if (value === null || value === undefined || value === '') return 'Not provided';
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	if (typeof value === 'number') {
		const formatted = new Intl.NumberFormat('en-NG', {
			minimumFractionDigits: header.includes('NGN') ? 2 : 0,
			maximumFractionDigits: 2
		}).format(value);
		if (header.includes('NGN')) return `NGN ${formatted}`;
		if (header.includes('%')) return `${value.toFixed(1)}%`;
		return formatted;
	}
	if (/reading|period/i.test(header) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
		return new Intl.DateTimeFormat('en-NG', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'Africa/Lagos'
		}).format(new Date(value));
	}
	return value;
};

const triggerDownload = (data: BlobPart, mimeType: string, fileName: string): void => {
	const blob = new Blob([data], { type: mimeType });
	const href = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = href;
	anchor.download = fileName;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(href), 1_000);
};

export async function buildBrandedPdf(report: ReportExportDocument, logo: string): Promise<ArrayBuffer> {
	const [{ jsPDF }, { default: autoTable }] = await Promise.all([
		import('jspdf'),
		import('jspdf-autotable')
	]);
	const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
	const pageWidth = document.internal.pageSize.getWidth();
	const pageHeight = document.internal.pageSize.getHeight();
	const margin = 13;
	const contentWidth = pageWidth - (margin * 2);

	const drawPageChrome = (pageNumber: number, pageCount: number) => {
		document.setPage(pageNumber);
		document.setFillColor(...BRAND.navy);
		document.rect(0, 0, pageWidth, 5, 'F');
		document.setFillColor(...BRAND.cyan);
		document.rect(0, 5, pageWidth * 0.42, 1.6, 'F');
		document.setFillColor(...BRAND.blue);
		document.rect(pageWidth * 0.42, 5, pageWidth * 0.25, 1.6, 'F');
		document.setFillColor(...BRAND.green);
		document.rect(pageWidth * 0.67, 5, pageWidth * 0.08, 1.6, 'F');

		if (pageNumber === 1) {
			document.addImage(logo, 'PNG', margin, 10, 48.4, 15);
		} else {
			document.setFont('helvetica', 'bold');
			document.setFontSize(9);
			document.setTextColor(...BRAND.navy);
			document.text('MICROACCESS SMART METERING', margin, 17);
			document.setFont('helvetica', 'normal');
			document.setFontSize(7.5);
			document.setTextColor(...BRAND.slate);
			document.text(report.title, margin, 22);
		}

		document.setDrawColor(...BRAND.line);
		document.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
		document.setFont('helvetica', 'normal');
		document.setFontSize(6.7);
		document.setTextColor(...BRAND.slate);
		document.text('MicroAccess Smart Metering  |  Management & Energy Intelligence  |  Confidential', margin, pageHeight - 7);
		document.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
	};

	document.setFont('helvetica', 'bold');
	document.setFontSize(7.5);
	document.setTextColor(...BRAND.blue);
	document.text('MANAGEMENT & ENERGY INTELLIGENCE', pageWidth - margin, 13, { align: 'right' });
	document.setFont('helvetica', 'normal');
	document.setFontSize(7);
	document.setTextColor(...BRAND.slate);
	document.text('Official operational report', pageWidth - margin, 18, { align: 'right' });

	document.setFont('helvetica', 'bold');
	document.setFontSize(18);
	document.setTextColor(...BRAND.navy);
	document.text(report.title, margin, 37);
	document.setFont('helvetica', 'normal');
	document.setFontSize(8);
	document.setTextColor(...BRAND.slate);
	document.text(`Reporting window: ${report.reportingWindow}`, margin, 43);
	document.text(`Scope: ${report.scope}`, margin, 48);
	document.text(`Generated: ${report.generatedAt}`, pageWidth - margin, 43, { align: 'right' });
	document.text(`Source: ${report.source}`, pageWidth - margin, 48, { align: 'right' });

	const summaryGap = 3;
	const summaryItems = report.summary.slice(0, 4);
	const summaryWidth = (contentWidth - (summaryGap * Math.max(0, summaryItems.length - 1))) / Math.max(1, summaryItems.length);
	summaryItems.forEach((item, index) => {
		const x = margin + (index * (summaryWidth + summaryGap));
		document.setFillColor(...BRAND.pale);
		document.setDrawColor(...BRAND.line);
		document.roundedRect(x, 54, summaryWidth, 20, 2.2, 2.2, 'FD');
		document.setFillColor(...(index === 0 ? BRAND.cyan : BRAND.sky));
		document.roundedRect(x, 54, 2, 20, 1, 1, 'F');
		document.setFont('helvetica', 'normal');
		document.setFontSize(6.5);
		document.setTextColor(...BRAND.slate);
		document.text(item.label.toUpperCase(), x + 5, 60);
		document.setFont('helvetica', 'bold');
		document.setFontSize(11.5);
		document.setTextColor(...BRAND.navy);
		document.text(item.value, x + 5, 67);
		if (item.detail) {
			document.setFont('helvetica', 'normal');
			document.setFontSize(6.2);
			document.setTextColor(...BRAND.slate);
			document.text(item.detail, x + 5, 71.5);
		}
	});

	autoTable(document, {
		startY: 81,
		head: [report.headers],
		body: report.rows.map((row) => row.map((value, index) => pdfValue(value, report.headers[index] ?? ''))),
		theme: 'grid',
		margin: { top: 29, right: margin, bottom: 18, left: margin },
		styles: {
			font: 'helvetica',
			fontSize: report.headers.length > 8 ? 6.4 : 7.2,
			cellPadding: 2.2,
			lineColor: BRAND.line,
			lineWidth: 0.15,
			textColor: BRAND.navy,
			valign: 'middle',
			overflow: 'linebreak'
		},
		headStyles: {
			fillColor: BRAND.navy,
			textColor: [255, 255, 255],
			fontStyle: 'bold',
			fontSize: report.headers.length > 8 ? 6.2 : 7,
			cellPadding: 2.6
		},
		alternateRowStyles: { fillColor: [246, 250, 252] },
		rowPageBreak: 'avoid'
	});

	const tableEndY = (document as typeof document & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 81;
	if (report.notes?.length) {
		let noteY = tableEndY + 7;
		if (noteY > pageHeight - 34) {
			document.addPage();
			noteY = 34;
		}
		document.setFont('helvetica', 'bold');
		document.setFontSize(7.5);
		document.setTextColor(...BRAND.blue);
		document.text('REPORT NOTES', margin, noteY);
		document.setFont('helvetica', 'normal');
		document.setTextColor(...BRAND.slate);
		report.notes.forEach((note) => {
			const lines = document.splitTextToSize(`• ${note}`, contentWidth);
			noteY += 4.5;
			document.text(lines, margin, noteY);
			noteY += Math.max(0, lines.length - 1) * 3.5;
		});
	}

	const pageCount = document.getNumberOfPages();
	for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) drawPageChrome(pageNumber, pageCount);
	document.setProperties({
		title: report.title,
		subject: `${report.reportingWindow} · ${report.scope}`,
		author: 'MicroAccess Smart Metering',
		creator: 'MicroAccess Management and Energy Intelligence'
	});
	return document.output('arraybuffer');
}

export async function downloadBrandedPdf(report: ReportExportDocument): Promise<void> {
	const logo = await fetchLogoDataUrl();
	const pdf = await buildBrandedPdf(report, logo);
	triggerDownload(pdf, 'application/pdf', `${safeFileName(report.fileName)}.pdf`);
}

const excelColumnFormat = (header: string): string | undefined => {
	if (header.includes('NGN')) return '₦#,##0.00';
	if (header.includes('%')) return '0.0"%"';
	if (header.includes('kWh')) return '#,##0.00';
	return undefined;
};

export async function buildBrandedExcel(report: ReportExportDocument, logo: string): Promise<ArrayBuffer> {
	const { default: ExcelJS } = await import('exceljs');
	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'MicroAccess Smart Metering';
	workbook.company = 'MicroAccess';
	workbook.subject = `${report.title} · ${report.reportingWindow}`;
	workbook.title = report.title;
	workbook.created = new Date();
	const sheet = workbook.addWorksheet('Report', {
		views: [{ state: 'frozen', ySplit: 12 }],
		pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
	});
	const columnCount = Math.max(report.headers.length, 8);
	const lastColumn = sheet.getColumn(columnCount).letter;
	const logoId = workbook.addImage({ base64: logo, extension: 'png' });
	sheet.addImage(logoId, { tl: { col: 0, row: 0.2 }, ext: { width: 210, height: 65 } });
	sheet.mergeCells(`C1:${lastColumn}2`);
	const titleCell = sheet.getCell('C1');
	titleCell.value = report.title;
	titleCell.font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: 'FF002B4D' } };
	titleCell.alignment = { vertical: 'middle', horizontal: 'right' };
	sheet.mergeCells(`C3:${lastColumn}3`);
	const subtitleCell = sheet.getCell('C3');
	subtitleCell.value = 'MANAGEMENT & ENERGY INTELLIGENCE';
	subtitleCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF104F82' } };
	subtitleCell.alignment = { horizontal: 'right' };
	sheet.getRow(4).height = 6;
	for (let column = 1; column <= columnCount; column += 1) {
		const cell = sheet.getCell(4, column);
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: column <= Math.ceil(columnCount * 0.45) ? 'FF23CBD6' : column <= Math.ceil(columnCount * 0.8) ? 'FF105082' : 'FF15B744' } };
	}

	sheet.mergeCells(`A5:${Math.max(2, Math.floor(columnCount / 2)) === 2 ? 'B' : sheet.getColumn(Math.floor(columnCount / 2)).letter}5`);
	sheet.getCell('A5').value = `Reporting window: ${report.reportingWindow}`;
	sheet.mergeCells(`${sheet.getColumn(Math.floor(columnCount / 2) + 1).letter}5:${lastColumn}5`);
	sheet.getCell(5, Math.floor(columnCount / 2) + 1).value = `Generated: ${report.generatedAt}`;
	sheet.mergeCells(`A6:${sheet.getColumn(Math.floor(columnCount / 2)).letter}6`);
	sheet.getCell('A6').value = `Scope: ${report.scope}`;
	sheet.mergeCells(`${sheet.getColumn(Math.floor(columnCount / 2) + 1).letter}6:${lastColumn}6`);
	sheet.getCell(6, Math.floor(columnCount / 2) + 1).value = `Source: ${report.source}`;
	for (const rowNumber of [5, 6]) {
		sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
			cell.font = { name: 'Aptos', size: 9, color: { argb: 'FF43596E' } };
			cell.alignment = { vertical: 'middle' };
		});
	}

	const summaryItems = report.summary.slice(0, 4);
	summaryItems.forEach((item, index) => {
		const start = Math.floor((index * columnCount) / summaryItems.length) + 1;
		const end = Math.max(start, Math.floor(((index + 1) * columnCount) / summaryItems.length));
		for (const rowNumber of [8, 9, 10]) sheet.mergeCells(rowNumber, start, rowNumber, end);
		const labelCell = sheet.getCell(8, start);
		const valueCell = sheet.getCell(9, start);
		const detailCell = sheet.getCell(10, start);
		labelCell.value = item.label.toUpperCase();
		valueCell.value = item.value;
		detailCell.value = item.detail ?? '';
		for (const cell of [labelCell, valueCell, detailCell]) {
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF6FA' } };
			cell.border = { left: { style: 'thin', color: { argb: 'FFD1E0E8' } }, right: { style: 'thin', color: { argb: 'FFD1E0E8' } } };
			cell.alignment = { vertical: 'middle' };
		}
		labelCell.font = { name: 'Aptos', size: 8, bold: true, color: { argb: 'FF43596E' } };
		valueCell.font = { name: 'Aptos Display', size: 14, bold: true, color: { argb: 'FF002B4D' } };
		detailCell.font = { name: 'Aptos', size: 8, color: { argb: 'FF43596E' } };
		labelCell.border = { ...labelCell.border, top: { style: 'thin', color: { argb: 'FFD1E0E8' } } };
		detailCell.border = { ...detailCell.border, bottom: { style: 'thin', color: { argb: 'FFD1E0E8' } } };
	});

	const headerRowNumber = 12;
	const headerRow = sheet.getRow(headerRowNumber);
	report.headers.forEach((header, index) => {
		const cell = headerRow.getCell(index + 1);
		cell.value = header;
		cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
		cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002B4D' } };
		cell.alignment = { vertical: 'middle', wrapText: true };
	});
	headerRow.height = 28;

	report.rows.forEach((values, rowIndex) => {
		const row = sheet.getRow(headerRowNumber + rowIndex + 1);
		values.forEach((value, columnIndex) => {
			const cell = row.getCell(columnIndex + 1);
			cell.value = value === null || value === undefined ? '' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
			cell.font = { name: 'Aptos', size: 9, color: { argb: 'FF002B4D' } };
			cell.alignment = { vertical: 'middle', wrapText: true };
			cell.border = { bottom: { style: 'hair', color: { argb: 'FFD1E0E8' } } };
			if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6FAFC' } };
			const numberFormat = excelColumnFormat(report.headers[columnIndex] ?? '');
			if (typeof value === 'number' && numberFormat) cell.numFmt = numberFormat;
		});
		row.height = 24;
	});

	sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber + report.rows.length, column: report.headers.length } };
	report.headers.forEach((header, index) => {
		const sampleWidths = report.rows.slice(0, 150).map((row) => displayValue(row[index]).length);
		const width = Math.min(34, Math.max(12, header.length + 2, ...sampleWidths.map((length) => Math.min(length + 2, 34))));
		sheet.getColumn(index + 1).width = width;
	});
	for (let column = report.headers.length + 1; column <= columnCount; column += 1) sheet.getColumn(column).width = 12;

	let finalRow = headerRowNumber + report.rows.length;
	if (report.notes?.length) {
		finalRow += 2;
		sheet.mergeCells(finalRow, 1, finalRow, columnCount);
		const notesTitle = sheet.getCell(finalRow, 1);
		notesTitle.value = 'REPORT NOTES';
		notesTitle.font = { name: 'Aptos', size: 9, bold: true, color: { argb: 'FF104F82' } };
		for (const note of report.notes) {
			finalRow += 1;
			sheet.mergeCells(finalRow, 1, finalRow, columnCount);
			const noteCell = sheet.getCell(finalRow, 1);
			noteCell.value = `• ${note}`;
			noteCell.font = { name: 'Aptos', size: 8, color: { argb: 'FF43596E' } };
			noteCell.alignment = { wrapText: true, vertical: 'top' };
			sheet.getRow(finalRow).height = 28;
		}
	}
	sheet.pageSetup.printArea = `A1:${lastColumn}${finalRow}`;
	sheet.headerFooter.oddFooter = '&LMicroAccess Smart Metering | Confidential&CManagement & Energy Intelligence&RPage &P of &N';

	const buffer = await workbook.xlsx.writeBuffer();
	return buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
}

export async function downloadBrandedExcel(report: ReportExportDocument): Promise<void> {
	const logo = await fetchLogoDataUrl();
	const workbook = await buildBrandedExcel(report, logo);
	triggerDownload(workbook, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${safeFileName(report.fileName)}.xlsx`);
}
