// Image compression and optimization utilities

export const compressImage = (file, quality = 0.8, maxWidth = 1200) => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64 with compression
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    
    img.src = file;
  });
};

export const validateImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!validTypes.includes(file.type)) {
    throw new Error('Please select a valid image file (JPG, PNG, WebP)');
  }
  
  if (file.size > maxSize) {
    throw new Error('Image file is too large. Please select an image under 10MB.');
  }
  
  return true;
};

export const getOptimalImageSettings = () => {
  // Detect device capabilities
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSlowConnection = navigator.connection && navigator.connection.effectiveType === 'slow-2g';
  
  return {
    quality: isSlowConnection ? 0.6 : isMobile ? 0.7 : 0.8,
    maxWidth: isSlowConnection ? 800 : isMobile ? 1000 : 1200,
    fastMode: isMobile || isSlowConnection
  };
};