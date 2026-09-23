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
  const vencimiento = new Date(expiraEn).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

  const text = `Hola ${nombre},

SafePlace utiliza wearables para monitorear indicadores biométricos (frecuencia cardíaca, actividad) y prevenir riesgos laborales como fatiga o sobreesfuerzo. Antes de activar el monitoreo necesitamos tu consentimiento explícito.

Para validarlo, ingresá al siguiente enlace:
${link}

Este enlace vence el ${vencimiento}.
Versión de política de privacidad: ${versionPolitica}.

Si no reconocés esta solicitud, podés ignorar este mensaje.

— Equipo SafePlace`;

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f3f5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f5fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#0f9c8c;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.02em;">SafePlace</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">Validá tu consentimiento biométrico</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">Hola ${nombre},</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                  SafePlace utiliza tu wearable para monitorear indicadores biométricos (frecuencia cardíaca y actividad) y prevenir riesgos laborales como fatiga o sobreesfuerzo. Antes de activar el monitoreo, necesitamos tu consentimiento explícito.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:8px;background-color:#0f9c8c;">
                      <a href="${link}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Validar consentimiento</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">Este enlace vence el <strong>${vencimiento}</strong>.</p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#6b7280;">Versión de política de privacidad: ${versionPolitica}.</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;">Si no reconocés esta solicitud, podés ignorar este mensaje.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">Equipo SafePlace · Monitoreo biométrico en tiempo real</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

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
      text,
      html,
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
