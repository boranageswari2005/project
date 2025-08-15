// Enhanced image utilities with perfect mobile optimization

export const detectDeviceCapabilities = () => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSlowConnection = navigator.connection && 
    (navigator.connection.effectiveType === 'slow-2g' || 
     navigator.connection.effectiveType === '2g' ||
     navigator.connection.saveData);
  
  const deviceMemory = navigator.deviceMemory || 4; // Default to 4GB if not available
  const isLowEndDevice = deviceMemory < 4;
  
  // Detect screen size
  const isSmallScreen = window.innerWidth < 768;
  
  return {
    isMobile,
    isSlowConnection,
    isLowEndDevice,
    isSmallScreen,
    quality: isSlowConnection ? 0.6 : isMobile ? 0.75 : 0.85,
    maxWidth: isSlowConnection ? 800 : isMobile ? 1000 : 1200,
    fastMode: isMobile || isSlowConnection || isLowEndDevice,
    deviceMemory,
    connectionType: navigator.connection?.effectiveType || 'unknown'
  };
};

export const compressImage = (file, quality = 0.8, maxWidth = 1200) => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate optimal dimensions
          let { width, height } = img;
          
          // Maintain aspect ratio while resizing
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          // Ensure minimum readable size
          const minWidth = 400;
          if (width < minWidth) {
            height = (height * minWidth) / width;
            width = minWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Enhanced image processing for better OCR
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Apply image enhancements for better text recognition
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Enhance contrast and brightness for better OCR
          for (let i = 0; i < data.length; i += 4) {
            // Increase contrast
            data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.2 + 128));     // Red
            data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.2 + 128)); // Green
            data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.2 + 128)); // Blue
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          // Convert to base64 with optimal quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // Log compression stats
          const originalSize = file.length || 0;
          const compressedSize = compressedDataUrl.length;
          const compressionRatio = originalSize > 0 ? ((originalSize - compressedSize) / originalSize * 100).toFixed(1) : 0;
          
          console.log(`📊 Image compressed: ${width}x${height}, ${compressionRatio}% reduction`);
          
          resolve(compressedDataUrl);
        } catch (error) {
          console.error('Canvas processing error:', error);
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = file;
    } catch (error) {
      reject(error);
    }
  });
};

export const validateImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const capabilities = detectDeviceCapabilities();
  const maxSize = capabilities.isMobile ? 8 * 1024 * 1024 : 10 * 1024 * 1024; // 8MB mobile, 10MB desktop
  
  if (!validTypes.includes(file.type)) {
    throw new Error('Please select a valid image file (JPG, PNG, WebP)');
  }
  
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    throw new Error(`Image file is too large. Please select an image under ${maxSizeMB}MB.`);
  }
  
  return true;
};

export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Enhanced image optimization for different scenarios
export const optimizeForOCR = async (imageData) => {
  const capabilities = detectDeviceCapabilities();
  
  // Use different optimization strategies based on device
  const settings = {
    quality: capabilities.isSlowConnection ? 0.7 : 0.85,
    maxWidth: capabilities.isMobile ? 1000 : 1200,
    enhanceContrast: true,
    sharpen: !capabilities.isLowEndDevice
  };
  
  return await compressImage(imageData, settings.quality, settings.maxWidth);
};