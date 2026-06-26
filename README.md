# Requisiciones y Cotizador Kadmiel

Este es el sistema interno de Kadmiel para la gestión de sucursales, inventario (stock), control de órdenes, y cotizador en tiempo real de Mesas de Postres y Pasteles Individuales.

## 🚀 Desarrollo Local

1. **Instalar Dependencias**:
   ```bash
   pnpm install
   # o bien:
   npm install
   ```

2. **Configurar el Entorno**:
   Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

3. **Iniciar Servidor de Desarrollo**:
   ```bash
   npm run dev
   ```

4. **Compilar para Producción**:
   ```bash
   npm run build
   ```
   Esto generará un directorio `dist` con los archivos estáticos listos para producción.

---

## 🛠️ Guía de Despliegue en Hostinger VPS (Nginx + PM2)

Dado que este proyecto está construido con **Vite (React + TypeScript)**, al compilar genera una aplicación de página única (**SPA**) puramente estática. A continuación se presentan las mejores prácticas de despliegue.

### 📌 Arquitectura Recomendada (Solo Nginx - Alto Rendimiento)
Al ser una aplicación web estática, **la mejor práctica es servir los archivos de `dist` directamente con Nginx**. Esto evita la sobrecarga de memoria de un proceso Node.js en ejecución y aprovecha al máximo la capacidad de Nginx para servir archivos estáticos con baja latencia.

1. **Subir cambios a GitHub**:
   Asegúrate de que tu rama `main` esté limpia y tus credenciales `.env` **no** estén subidas a GitHub (están protegidas por el `.gitignore`).

2. **Clonar y compilar en el servidor**:
   Conéctate a tu VPS de Hostinger vía SSH y ejecuta:
   ```bash
   cd /var/www
   git clone https://github.com/tu-usuario/requisiciones-kadmiel.git kadmiel-app
   cd kadmiel-app
   
   # Crear el archivo .env de producción
   nano .env
   # Pega las credenciales de Supabase de producción y guarda (Ctrl+O, Ctrl+X)

   # Instalar y construir el build
   npm install
   npm run build
   ```

3. **Configurar Nginx**:
   Crea o modifica el bloque de servidor de tu sitio en `/etc/nginx/sites-available/kadmiel`:
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com www.tu-dominio.com;

       root /var/www/kadmiel-app/dist;
       index index.html;

       location / {
           # Regla CRÍTICA para React Router (SPA)
           # Si Nginx no encuentra la ruta física del archivo, redirige a index.html
           try_files $uri $uri/ /index.html;
       }

       # Opcional: Caché de archivos estáticos
       location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }

       error_log /var/log/nginx/kadmiel_error.log;
       access_log /var/log/nginx/kadmiel_access.log;
   }
   ```
   Habilita el sitio y reinicia Nginx:
   ```bash
   ln -s /etc/nginx/sites-available/kadmiel /etc/nginx/sites-enabled/
   nginx -t  # Verifica que la sintaxis de configuración sea correcta
   systemctl restart nginx
   ```

---

### 📌 Arquitectura Alternativa (Node.js Preview + PM2 + Nginx Proxy)
Si necesitas servir la app usando Node.js (por ejemplo, para correr el comando `vite preview` o un servidor Express de soporte) y administrarlo con PM2:

1. **Configurar PM2**:
   Instala un servidor estático rápido globalmente en el VPS:
   ```bash
   npm install -g serve
   ```
   O crea un archivo `ecosystem.config.cjs` en la raíz del proyecto para definir el proceso de PM2:
   ```javascript
   module.exports = {
     apps: [
       {
         name: "kadmiel-app",
         script: "serve",
         env: {
           PM2_SERVE_PATH: "./dist",
           PM2_SERVE_PORT: 3000,
           PM2_SERVE_SPA: "true", // Habilita enrutamiento de React Router
           NODE_ENV: "production"
         }
       }
     ]
   };
   ```

2. **Iniciar con PM2**:
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup  # Sigue las instrucciones para habilitar el inicio automático al reiniciar el servidor
   ```

3. **Configurar Nginx como Proxy Reverso**:
   Modifica tu bloque de servidor de Nginx para redirigir el tráfico al puerto de PM2:
   ```nginx
   server {
       listen 80;
       server_name tu-dominio.com www.tu-dominio.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   Verifica y reinicia Nginx:
   ```bash
   nginx -t
   systemctl restart nginx
   ```

---

## 🔄 Flujo de Actualización Continua (CI/CD Básico)

Cada vez que subas cambios a GitHub y desees actualizar tu VPS:

1. Crea un script simple de actualización (`deploy.sh`) en tu servidor:
   ```bash
   #!/bin/bash
   cd /var/www/kadmiel-app
   git pull origin main
   npm install
   npm run build
   
   # Si usas la arquitectura PM2:
   pm2 restart kadmiel-app
   
   echo "¡Despliegue completado!"
   ```
2. Dale permisos de ejecución:
   ```bash
   chmod +x deploy.sh
   ```
3. Ejecútalo cada vez que quieras desplegar: `./deploy.sh`
