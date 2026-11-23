const PDFDocument = require('pdfkit');

/**
 * Format paisa into Indian Rupee representation ₹X,XXX.XX
 */
const formatINR = (paisa) => {
  const rupees = (Number(paisa || 0) / 100);
  return 'Rs. ' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Generate GST Tax Invoice PDF Buffer
 */
const generateInvoicePDF = (invoiceData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const { company, customer, invoice, lines, totals } = invoiceData;

      // Header Banner
      doc.fontSize(18).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
      doc.moveDown(0.5);

      // Company Info (Left) and Invoice Meta (Right)
      const topY = doc.y;
      doc.fontSize(12).font('Helvetica-Bold').text(company.name || 'Sri Lakshmi Foods', 40, topY);
      doc.fontSize(9).font('Helvetica').text(company.address || '12, Industrial Estate, Srirangam, Tiruchirappalli - 620006');
      doc.text(`GSTIN: ${company.gstin || '33AABCS1429B1ZB'}`);
      doc.text(`State: ${company.state || 'Tamil Nadu'} (Code: ${company.state_code || '33'})`);
      doc.text(`Phone: ${company.phone || '0431-2345678'} | Email: ${company.email || 'info@srilakshmifoods.com'}`);

      // Invoice Details (Right column)
      doc.fontSize(10).font('Helvetica-Bold').text(`Invoice No: ${invoice.invoice_number}`, 340, topY);
      doc.font('Helvetica').text(`Invoice Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}`, 340, topY + 15);
      doc.text(`Place of Supply: ${invoice.place_of_supply_state} (${invoice.place_of_supply_code})`, 340, topY + 30);
      doc.text(`Supply Type: ${invoice.is_igst ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}`, 340, topY + 45);

      doc.moveDown(2);
      const dividerY1 = doc.y;
      doc.moveTo(40, dividerY1).lineTo(555, dividerY1).stroke('#cccccc');
      doc.moveDown(0.5);

      // Bill To (Customer)
      doc.fontSize(10).font('Helvetica-Bold').text('Bill To (Customer Details):', 40);
      doc.fontSize(9).font('Helvetica-Bold').text(customer.name);
      doc.font('Helvetica').text(customer.address || 'Customer Address');
      doc.text(`City: ${customer.city || ''}, State: ${customer.state} (${customer.state_code})`);
      doc.text(`GSTIN: ${customer.gstin || 'Unregistered'}`);
      if (customer.phone) doc.text(`Phone: ${customer.phone}`);

      doc.moveDown(1);
      const tableTop = doc.y;

      // Table Header
      doc.rect(40, tableTop, 515, 20).fill('#e65100');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('#', 45, tableTop + 5, { width: 20 });
      doc.text('Item Description', 65, tableTop + 5, { width: 140 });
      doc.text('HSN', 205, tableTop + 5, { width: 45 });
      doc.text('Qty', 250, tableTop + 5, { width: 35, align: 'right' });
      doc.text('Rate', 290, tableTop + 5, { width: 50, align: 'right' });
      doc.text('Taxable', 345, tableTop + 5, { width: 60, align: 'right' });
      if (invoice.is_igst) {
        doc.text('IGST', 410, tableTop + 5, { width: 65, align: 'right' });
      } else {
        doc.text('CGST/SGST', 410, tableTop + 5, { width: 65, align: 'right' });
      }
      doc.text('Total', 480, tableTop + 5, { width: 70, align: 'right' });

      doc.fillColor('#000000');
      let rowY = tableTop + 24;

      // Line items
      lines.forEach((line, index) => {
        doc.fontSize(8).font('Helvetica');
        doc.text(String(index + 1), 45, rowY, { width: 20 });
        doc.text(line.description || 'Item', 65, rowY, { width: 140 });
        doc.text(line.hsn_code || '-', 205, rowY, { width: 45 });
        doc.text(`${parseFloat(line.qty)} ${line.unit || ''}`, 250, rowY, { width: 35, align: 'right' });
        doc.text(formatINR(line.rate_paisa), 290, rowY, { width: 50, align: 'right' });
        doc.text(formatINR(line.taxable_amount_paisa), 345, rowY, { width: 60, align: 'right' });

        if (invoice.is_igst) {
          doc.text(`${formatINR(line.igst_paisa)} (${line.igst_percent}%)`, 410, rowY, { width: 65, align: 'right' });
        } else {
          const totalCgSg = parseInt(line.cgst_paisa || 0) + parseInt(line.sgst_paisa || 0);
          doc.text(`${formatINR(totalCgSg)} (${parseFloat(line.gst_rate_percent)}%)`, 410, rowY, { width: 65, align: 'right' });
        }

        doc.text(formatINR(line.total_paisa), 480, rowY, { width: 70, align: 'right' });

        rowY += 18;
        doc.moveTo(40, rowY - 2).lineTo(555, rowY - 2).stroke('#eeeeee');
      });

      // Totals Box
      rowY += 10;
      doc.fontSize(9).font('Helvetica');
      doc.text('Subtotal (Taxable Value):', 320, rowY, { width: 130, align: 'right' });
      doc.text(formatINR(totals.subtotal_paisa), 460, rowY, { width: 90, align: 'right' });
      rowY += 15;

      if (invoice.is_igst) {
        doc.text('IGST Total:', 320, rowY, { width: 130, align: 'right' });
        doc.text(formatINR(totals.igst_paisa), 460, rowY, { width: 90, align: 'right' });
        rowY += 15;
      } else {
        doc.text('CGST Total:', 320, rowY, { width: 130, align: 'right' });
        doc.text(formatINR(totals.cgst_paisa), 460, rowY, { width: 90, align: 'right' });
        rowY += 15;

        doc.text('SGST Total:', 320, rowY, { width: 130, align: 'right' });
        doc.text(formatINR(totals.sgst_paisa), 460, rowY, { width: 90, align: 'right' });
        rowY += 15;
      }

      doc.rect(320, rowY, 235, 22).fill('#fff3e0');
      doc.fillColor('#e65100').fontSize(11).font('Helvetica-Bold');
      doc.text('Invoice Total:', 330, rowY + 5, { width: 120 });
      doc.text(formatINR(totals.total_paisa), 450, rowY + 5, { width: 100, align: 'right' });
      doc.fillColor('#000000');

      // Footer
      doc.fontSize(8).font('Helvetica-Oblique').text(
        'Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
        40, 720, { width: 515, align: 'left' }
      );
      doc.fontSize(8).font('Helvetica-Bold').text(
        'For Sri Lakshmi Foods - Authorized Signatory',
        350, 760, { width: 200, align: 'right' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateInvoicePDF,
  formatINR
};
