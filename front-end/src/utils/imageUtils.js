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
    // Enhanced quality settings for better OCR
    quality: isSlowConnection ? 0.8 : isMobile ? 0.9 : 0.95,
    maxWidth: isSlowConnection ? 1200 : isMobile ? 1600 : 1920,
    fastMode: isMobile || isSlowConnection || isLowEndDevice,
    deviceMemory,
    connectionType: navigator.connection?.effectiveType || 'unknown'
  };
};

export const compressImage = (file, quality = 0.8, maxWidth = 1200) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`🖼️ Starting image optimization: quality=${quality}, maxWidth=${maxWidth}`);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate optimal dimensions
          let { width, height } = img;
          console.log(`📐 Original dimensions: ${width}x${height}`);
          
          // For OCR, we want to maintain higher resolution
          // Only resize if image is extremely large
          const maxOCRWidth = maxWidth * 1.5; // Allow larger images for better OCR
          if (width > maxOCRWidth) {
            height = (height * maxOCRWidth) / width;
            width = maxOCRWidth;
          }
          
          // Ensure minimum readable size for OCR
          const minWidth = 800; // Increased minimum width for better OCR
          if (width < minWidth) {
            height = (height * minWidth) / width;
            width = minWidth;
          }
          
          console.log(`📐 Final dimensions: ${width}x${height}`);
          
          canvas.width = width;
          canvas.height = height;
          
          // Optimized settings for OCR
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Enhanced image processing specifically for OCR
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Advanced OCR-optimized image enhancement
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Convert to grayscale for better text detection
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // Enhanced contrast and brightness for text
            const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.3 + 140));
            
            // Apply back to RGB channels
            data[i] = enhanced;     // Red
            data[i + 1] = enhanced; // Green
            data[i + 2] = enhanced; // Blue
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          // Use higher quality for OCR images
          const ocrQuality = Math.max(quality, 0.9); // Minimum 90% quality for OCR
          const compressedDataUrl = canvas.toDataURL('image/jpeg', ocrQuality);
          
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