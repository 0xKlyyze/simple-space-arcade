# Simple Space Arcade - Deployment Guide

## Build Configuration

The project is configured for production deployment with the following optimizations:

- **Code Splitting**: Vendor libraries (React, PeerJS) are bundled separately
- **Minification**: CSS and JavaScript are minified using esbuild
- **Source Maps**: Generated for debugging in production
- **Asset Optimization**: Images and assets are optimized and versioned

## Build Scripts

### Development
```bash
# Standard development server
npm run dev

# Development with HTTPS (required for WebRTC testing)
npm run dev:https
```

### Production Build
```bash
# Full production build with type checking
npm run deploy:build

# Standard build
npm run build

# Build with bundle analysis
npm run build:analyze
```

### Preview
```bash
# Preview production build
npm run preview

# Preview with HTTPS
npm run preview:https
```

## HTTPS Configuration

**Important**: WebRTC requires HTTPS in production environments. The game will work on localhost without HTTPS, but for network play between different devices, HTTPS is mandatory.

### Local Network Testing
1. Use `npm run dev:https` for HTTPS development
2. Accept the self-signed certificate warning
3. Ensure both devices accept the certificate
4. Connect devices to the same WiFi network

## Deployment Options

### Static Hosting (Recommended)
The built application is a static site that can be deployed to:

- **Netlify**: Drag and drop the `dist` folder
- **Vercel**: Connect GitHub repository for automatic deployments
- **GitHub Pages**: Upload `dist` contents to gh-pages branch
- **Firebase Hosting**: Use Firebase CLI to deploy

### Manual Deployment Steps
1. Run `npm run deploy:build`
2. Upload the entire `dist` folder to your hosting provider
3. Ensure HTTPS is enabled on your domain
4. Configure proper MIME types for `.js` and `.css` files

## Testing Procedures

### Local Testing
1. **Single Player**: Verify game mechanics work without network
2. **Network Connection**: Test host/join functionality
3. **Game Synchronization**: Ensure both players see the same game state
4. **Error Handling**: Test connection drops and reconnection

### Multi-Device Testing
1. Connect both devices to the same WiFi network
2. Host game on one device, note the Peer ID
3. Join game from second device using the Peer ID
4. Verify real-time gameplay synchronization
5. Test various network conditions (weak signal, etc.)

### Common Issues

#### WebRTC Connection Fails
- Ensure HTTPS is enabled
- Check firewall settings
- Verify both devices are on the same network
- Try refreshing both browsers

#### Game Desynchronization
- Check network latency
- Verify both clients are running the same version
- Monitor browser console for errors

#### Performance Issues
- Enable hardware acceleration in browser
- Close other tabs/applications
- Check device specifications meet minimum requirements

## Browser Compatibility

### Supported Browsers
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Required Features
- WebRTC support
- Canvas API
- ES2020 support
- CSS Grid and Flexbox

## Production Checklist

- [ ] HTTPS enabled
- [ ] All assets loading correctly
- [ ] WebRTC connections working
- [ ] Error handling functional
- [ ] Performance metrics acceptable
- [ ] Cross-browser testing completed
- [ ] Mobile responsiveness verified
- [ ] Network error recovery tested

## Monitoring

The application includes built-in error handling and logging:

- Network connection status
- WebRTC connection quality
- Game performance metrics
- Error reporting and recovery

Monitor browser console for any runtime errors or performance warnings.

## Support

For deployment issues:
1. Check browser console for errors
2. Verify network connectivity
3. Ensure HTTPS configuration
4. Test with different browsers/devices