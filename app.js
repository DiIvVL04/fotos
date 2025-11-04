const video        = document.getElementById('video');
const canvas       = document.getElementById('canvas');
const ctx          = canvas.getContext('2d');
const fileCapture  = document.getElementById('fileCapture');

let stream = null;
let currentFacing = 'environment'; // o 'user'

const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const standalone = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;

function openNativeCameraFallback() {
  fileCapture.setAttribute('capture', currentFacing === 'user' ? 'user' : 'environment');
  fileCapture.click();
}

async function openCamera() {
  // En iOS + PWA (atajo), intenta; si falla, usa fallback nativo
  const tryFallback = isiOS && standalone;

  try {
    const constraints = {
      video: {
        facingMode: { ideal: currentFacing },
        width: { ideal: 1280 }, height: { ideal: 720 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    // iOS requiere gesto del usuario; aún así intenta play() por si acaso:
    await video.play().catch(() => {});
  } catch (err) {
    console.warn('getUserMedia falló:', err);
    if (tryFallback) {
      // En atajo, abre cámara nativa del sistema
      openNativeCameraFallback();
      return;
    } else {
      alert('No se pudo abrir la cámara. Revisa permisos y HTTPS.');
      return;
    }
  }
}

// Cuando el usuario selecciona/“toma” una foto en el fallback
fileCapture.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    // Respeta orientación EXIF en iOS
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    canvas.width = bmp.width; canvas.height = bmp.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
  } catch {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = URL.createObjectURL(file);
  }
});

// (Opcional) para foto desde stream cuando sí funciona
function takePhotoFromStream() {
  if (!stream) return openNativeCameraFallback();
  const vw = video.videoWidth, vh = video.videoHeight;
  canvas.width = vw; canvas.height = vh;
  ctx.drawImage(video, 0, 0, vw, vh);
  // Exporta como JPEG (mejor compatibilidad iOS)
  const dataURL = canvas.toDataURL('image/jpeg', 0.92);
  console.log('foto JPEG lista', dataURL.length);
}