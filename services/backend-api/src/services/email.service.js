const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    const error = new Error('El servidor de correo no está configurado.');
    error.status = 503;
    error.motivo = 'EMAIL_NO_CONFIGURADO';
    throw error;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_PORT || 587) === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    // Render no tiene salida IPv6: forzamos que la conexión TCP resuelva
    // solo registros A (IPv4). dns.setDefaultResultOrder('ipv4first') solo
    // reordena si hay AAAA y A disponibles; acá forzamos la familia.
    family: 4,
  });
  return transporter;
};

const enviarSolicitudConsentimiento = async ({ email, nombre, link, versionPolitica, expiraEn }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({
    from,
    to: email,
    subject: 'SafePlace: validá tu consentimiento biométrico',
    text: `Hola ${nombre}. Para validar tu consentimiento biométrico de SafePlace, ingresá a este enlace: ${link}. El enlace vence el ${new Date(expiraEn).toLocaleString('es-AR')}. Política: ${versionPolitica}.`,
    html: `<p>Hola ${nombre}.</p><p>Para validar tu consentimiento biométrico de SafePlace, hacé clic en el siguiente enlace:</p><p><a href="${link}">Validar consentimiento</a></p><p>El enlace vence el ${new Date(expiraEn).toLocaleString('es-AR')}.</p><p>Versión de política: ${versionPolitica}.</p>`,
  });
};

module.exports = { enviarSolicitudConsentimiento };
