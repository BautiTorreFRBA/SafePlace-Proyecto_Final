const nodemailer = require('nodemailer');
const dns = require('dns');
const { promisify } = require('util');

const dnsLookup = promisify(dns.lookup);

let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    const error = new Error('El servidor de correo no está configurado.');
    error.status = 503;
    error.motivo = 'EMAIL_NO_CONFIGURADO';
    throw error;
  }

  // nodemailer resuelve el host con dns.resolve4/resolve6 (no dns.lookup),
  // y en Render resolve4 falla silenciosamente dejando solo la IPv6 -
  // ENETUNREACH porque Render no tiene salida IPv6. Resolvemos nosotros
  // con dns.lookup (que sí anda bien ahí) y le pasamos la IP ya resuelta,
  // manteniendo el hostname original en `servername` para el TLS/SNI.
  const { address } = await dnsLookup(SMTP_HOST, { family: 4 });

  transporter = nodemailer.createTransport({
    host: address,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_PORT || 587) === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    tls: { servername: SMTP_HOST },
  });
  return transporter;
};

const enviarSolicitudConsentimiento = async ({ email, nombre, link, versionPolitica, expiraEn }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transport = await getTransporter();
  await transport.sendMail({
    from,
    to: email,
    subject: 'SafePlace: validá tu consentimiento biométrico',
    text: `Hola ${nombre}. Para validar tu consentimiento biométrico de SafePlace, ingresá a este enlace: ${link}. El enlace vence el ${new Date(expiraEn).toLocaleString('es-AR')}. Política: ${versionPolitica}.`,
    html: `<p>Hola ${nombre}.</p><p>Para validar tu consentimiento biométrico de SafePlace, hacé clic en el siguiente enlace:</p><p><a href="${link}">Validar consentimiento</a></p><p>El enlace vence el ${new Date(expiraEn).toLocaleString('es-AR')}.</p><p>Versión de política: ${versionPolitica}.</p>`,
  });
};

module.exports = { enviarSolicitudConsentimiento };
