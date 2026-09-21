import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { IDispatch } from './dispatch.model.js';
import { IPatient } from '../patients/patient.model.js';
import { IOrder } from '../orders/order.model.js';

export class RoutingSlipService {
  /**
   * Generates a clinical routing slip PDF with barcode/QR code and clinical metadata
   */
  static async generateRoutingSlipPdf(
    dispatch: IDispatch,
    patient: IPatient,
    order?: IOrder | null,
    fromDeptName = 'Origin Department',
    toDeptName = 'Destination Department'
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A5', margin: 30 });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        // Generate QR code buffer containing clinical tracking URI
        const qrData = JSON.stringify({
          dispatchId: dispatch._id.toString(),
          orderId: dispatch.orderId.toString(),
          mrn: patient.mrn,
          type: dispatch.type,
          priority: dispatch.priority,
        });

        const qrCodeBuffer = await QRCode.toBuffer(qrData, {
          width: 100,
          margin: 1,
          color: { dark: '#002B49', light: '#FFFFFF' },
        });

        // Header
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .fillColor('#002B49')
          .text('CLINICAL DISPATCH ROUTING SLIP', { align: 'center' });

        doc.moveDown(0.5);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#555555')
          .text(`Tracking ID: ${dispatch._id.toString()}`, { align: 'center' });

        doc.moveDown(0.8);
        doc.strokeColor('#CCCCCC').lineWidth(1).moveTo(30, doc.y).lineTo(390, doc.y).stroke();
        doc.moveDown(0.8);

        // Priority Badge Box
        const priorityColor =
          dispatch.priority === 'STAT' ? '#BA1A1A' : dispatch.priority === 'URGENT' ? '#B86200' : '#006A6A';

        doc
          .rect(30, doc.y, 80, 20)
          .fill(priorityColor);

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#FFFFFF')
          .text(dispatch.priority, 35, doc.y - 15, { width: 70, align: 'center' });

        doc.moveDown(1.2);

        // Patient Banner
        const patientName = `${patient.name.family.toUpperCase()}, ${patient.name.given.join(' ')}`;
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#1E1E1E')
          .text(`Patient: ${patientName}`);

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#333333')
          .text(`MRN: ${patient.mrn}   |   DOB: ${patient.dob}   |   Sex: ${patient.sex}`);

        doc.moveDown(0.8);
        doc.strokeColor('#EEEEEE').lineWidth(1).moveTo(30, doc.y).lineTo(390, doc.y).stroke();
        doc.moveDown(0.8);

        // Routing Information
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#002B49')
          .text('DISPATCH DETAILS:');

        doc.moveDown(0.3);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#222222')
          .text(`Type: ${dispatch.type}`)
          .text(`From: ${fromDeptName}`)
          .text(`To: ${toDeptName}`)
          .text(`Created: ${dispatch.createdAt.toISOString()}`)
          .text(`SLA Target: ${dispatch.slaMinutes} mins (Due: ${dispatch.slaDueAt.toISOString()})`);

        if (order) {
          doc.moveDown(0.5);
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .text(`Order: ${order.name} (${order.type})`)
            .font('Helvetica')
            .text(`Indication: ${order.indication}`);
        }

        if (dispatch.notes) {
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica-Oblique').text(`Notes: ${dispatch.notes}`);
        }

        // Draw QR Code
        doc.image(qrCodeBuffer, 280, 160, { width: 95, height: 95 });

        // Footer Barcode representation / instructions
        doc.moveDown(2);
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#666666')
          .text('Scan QR code at destination department upon receipt to acknowledge transfer.', 30, 360, {
            align: 'center',
            width: 360,
          });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
