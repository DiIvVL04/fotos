const openCameraBtn   = document.getElementById('openCamera');
const cameraContainer = document.getElementById('cameraContainer');
const video           = document.getElementById('video');
const takePhotoBtn    = document.getElementById('takePhoto');
const canvas          = document.getElementById('canvas');
const fileCapture     = document.getElementById('fileCapture');
const switchBtn       = document.getElementById('switchCamera');
const ctx             = canvas.getContext('2d');

let stream = null;
let currentFacing = 'environment'; // 'environment' o 'user'

// Detectores útiles
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;

// Ajusta el tamaño interno del canvas al tamaño REAL del video
function setCanvasSizeFromVideo() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw && vh) {
    // Por defecto el canvas coincide con el buffer del video
    canvas.width  = vw;
    canvas.height = vh;
  }
}

// Dibuja el frame corrigiendo orientación y espejo (frontal)
function drawFrameToCanvas() {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  // ¿Pantalla en vertical?
  const portraitScreen = window.innerHeight > window.innerWidth;
  // iPhone suele entregar el sensor en landscape (vw > vh). Si estamos en vertical, rotamos 90°
  const needRotate90 = portraitScreen && vw > vh;

  // Tamaños del canvas según rotación
  if (needRotate90) {
    canvas.width  = vh;
    canvas.height = vw;
  } else {
    canvas.width  = vw;
    canvas.height = vh;
  }

  ctx.save();

  if (needRotate90) {
    // Rotamos el lienzo -90° para enderezar la foto en vertical
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
    // Si es frontal, des-espejamos en el eje X
    if (getFacing() === 'user') {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, vw, vh);
  } else {
    // Sin rotación; sólo corregimos espejo si es frontal
    if (getFacing() === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, vw, vh);
  }

  ctx.restore();
}

function getFacing() {
  try {
    return stream?.getVideoTracks?.()[0]?.getSettings?.().facingMode || currentFacing;
  } catch {
    return currentFacing;
  }
}

// Intenta abrir la cámara; si falla en iOS/atajo, usa fallback por archivo
async function openCamera() {
  try {
    // Preferencias de cámara según lo último seleccionado
    const constraints = {
      video: {
        facingMode: { ideal: currentFacing }, // 'environment' o 'user'
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    await new Promise(res => {
      if (video.readyState >= 1 && video.videoWidth > 0) return res();
      video.onloadedmetadata = () => res();
    });

    setCanvasSizeFromVideo();
    window.addEventListener('resize', setCanvasSizeFromVideo, { passive: true });

    cameraContainer.style.display = 'block';
    openCameraBtn.textContent = 'Cámara Abierta';
    openCameraBtn.disabled = true;
    switchBtn.disabled = false;
    console.log('ready:', video.videoWidth, 'x', video.videoHeight);
  } catch (err) {
    console.warn('getUserMedia error:', err);

    // Fallback iOS para apps instaladas como atajo (y/o versiones con limitación)
    if (isIOS && isStandalone) {
      alert('En iPhone desde el atajo, la cámara en vivo puede no estar disponible. Abre la cámara nativa para tomar una foto.');
      openFileCapture(); // dispara cámara nativa
      cameraContainer.style.display = 'block';
      openCameraBtn.textContent = 'Usando cámara nativa';
      openCameraBtn.disabled = false;
      switchBtn.disabled = true; // no aplica en fallback
    } else {
    }
  }
}

// Fallback: abre la cámara nativa mediante input file
function openFileCapture() {
  // Forzamos environment; si quieres frontal en fallback, podrías crear otro input con capture="user"
  fileCapture.setAttribute('capture', 'environment');
  fileCapture.click();
}

// Carga la imagen capturada por el input y la dibuja corrigiendo EXIF si es posible
fileCapture.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  // Intentamos respetar la orientación EXIF si el navegador soporta imageOrientation
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    canvas.style.display = 'block';
  } catch {
    // Fallback simple
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.style.display = 'block';
    };
    img.src = URL.createObjectURL(file);
  }
});

// Toma la foto del stream corrigiendo rotación y espejo; guarda como JPEG
function takePhoto() {
  // Si no hay stream activo, pero hay fallback, permite tomar de input
  if (!stream) {
    if (isIOS && isStandalone) {
      openFileCapture();
      return;
    }
    alert('Primero abre la cámara');
    return;
  }

  drawFrameToCanvas();     // corrige orientación/espejo
  canvas.style.display = 'block';

  // JPEG mejora compatibilidad en iOS; ajusta calidad si gustas (0.8–0.95)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // Ejemplo para descargar:
  // const a = document.createElement('a');
  // a.href = dataUrl;
  // a.download = foto_${Date.now()}.jpg;
  // a.click();
  console.log('jpg base64 length:', dataUrl.length);
}

function closeCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
  openCameraBtn.textContent = 'Abrir Cámara';
  openCameraBtn.disabled = false;
  switchBtn.disabled = false;
  canvas.style.display = 'none';
  cameraContainer.style.display = 'none';
  window.removeEventListener('resize', setCanvasSizeFromVideo);
}

// Cambiar entre frontal y trasera (sólo cuando getUserMedia está activo)
async function switchCamera() {
  currentFacing = (getFacing() === 'user') ? 'environment' : 'user';
  // Reiniciamos el stream con el nuevo facing
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  await openCamera();
}

openCameraBtn.addEventListener('click', openCamera);
takePhotoBtn.addEventListener('click', takePhoto);
switchBtn.addEventListener('click', switchCamera);
window.addEventListener('beforeunload', closeCamera);

// También re-dibuja si la orientación de la pantalla cambia mientras la cámara está abierta
window.addEventListener('orientationchange', () => {
  if (stream) {
    setTimeout(() => {
      setCanvasSizeFromVideo();
      // No tomamos foto automática; solo dejamos listo el canvas correcto
    }, 200);
  }
}, { passive: true });