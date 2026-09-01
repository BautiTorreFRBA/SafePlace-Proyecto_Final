const RESEND_API_URL = 'https://api.resend.com/emails';

const enviarSolicitudConsentimiento = async ({ email, nombre, link, versionPolitica, expiraEn }) => {
  const { RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!RESEND_API_KEY) {
    const error = new Error('El servidor de correo no está configurado.');
    error.status = 503;
    error.motivo = 'EMAIL_NO_CONFIGURADO';
    throw error;
  }

  const from = RESEND_FROM || 'SafePlace <onboarding@resend.dev>';
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'SafePlace: validá tu consentimiento biométrico',
      text: `Hola ${nombre}. Para validar tu consentimiento biométrico de SafePlace, ingresá a este enlace: ${link}. El enlace vence el ${new Date(expiraEn).toLocaleString('es-AR')}. Política: ${versionPolitica}.`,
      html: `<p>Hola ${nombre}.</p><p>Para validar tu consentimiento biométrico de SafePlace, hacé clic en el siguiente enlace:</p><p><a href="${link}">Validar consentimiento</a></p><p>El enlace vence el ${new Date(expiraEn).toLocaleString('es-AR')}.</p><p>Versión de política: ${versionPolitica}.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || 'No se pudo enviar el email de consentimiento.');
    error.status = 502;
    error.motivo = 'EMAIL_ENVIO_FALLIDO';
    throw error;
  }
};

module.exports = { enviarSolicitudConsentimiento };
