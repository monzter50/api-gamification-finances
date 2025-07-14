# API de Gamificación de Finanzas

Una API RESTful completa para gestionar finanzas personales con elementos de gamificación, desarrollada con **Node.js**, **Express**, **TypeScript** y **MongoDB**.

## 🚀 Características

### 💰 Gestión Financiera
- **Transacciones**: Ingresos, gastos y ahorros
- **Categorización**: Sistema de categorías para organizar transacciones
- **Metas de ahorro**: Establecer y rastrear objetivos financieros
- **Resúmenes**: Estadísticas mensuales y generales

### 🎮 Gamificación
- **Sistema de niveles**: Progresión basada en experiencia
- **Monedas virtuales**: Sistema de recompensas
- **Logros**: Desbloqueo de logros por metas alcanzadas
- **Tabla de clasificación**: Competencia entre usuarios
- **Rachas**: Seguimiento de actividad diaria

### 🔐 Autenticación y Seguridad
- **JWT**: Autenticación basada en tokens
- **Encriptación**: Contraseñas hasheadas con bcrypt
- **Validación**: Validación de datos con express-validator
- **Rate limiting**: Protección contra ataques de fuerza bruta

### 🛠️ Tecnologías
- **TypeScript**: Tipado estático para mayor robustez
- **ES Modules**: Sistema de módulos moderno
- **Vitest**: Framework de testing moderno
- **ESLint**: Linting con reglas TypeScript

## 📋 Requisitos Previos

- Node.js (versión 18 o superior)
- MongoDB (local o Atlas)
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd api-gamification-finances
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp env.example .env
   ```
   
   Editar el archivo `.env` con tus configuraciones:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/gamification-finances
   JWT_SECRET=tu-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   ```

4. **Compilar TypeScript**
   ```bash
   npm run build
   ```

5. **Poblar la base de datos con logros**
   ```bash
   npm run seed
   ```

6. **Iniciar el servidor**
   ```bash
   # Desarrollo (con hot reload)
   npm run dev
   
   # Producción
   npm start
   ```

## 📚 Scripts Disponibles

- `npm run build` - Compilar TypeScript a JavaScript
- `npm start` - Iniciar servidor en producción
- `npm run dev` - Iniciar servidor en desarrollo con hot reload
- `npm test` - Ejecutar tests con Vitest
- `npm run test:ui` - Ejecutar tests con interfaz gráfica
- `npm run test:coverage` - Ejecutar tests con cobertura
- `npm run lint` - Verificar código con ESLint
- `npm run lint:fix` - Corregir errores de ESLint automáticamente
- `npm run type-check` - Verificar tipos de TypeScript
- `npm run seed` - Poblar base de datos con logros

## 📚 Documentación de la API

### Endpoints Principales

#### 🔐 Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Obtener perfil del usuario actual

#### 👤 Usuarios
- `GET /api/users/profile` - Obtener perfil del usuario
- `PUT /api/users/profile` - Actualizar perfil del usuario
- `GET /api/users/stats` - Obtener estadísticas del usuario

#### 💳 Transacciones
- `GET /api/transactions` - Obtener todas las transacciones del usuario
- `POST /api/transactions` - Crear nueva transacción
- `GET /api/transactions/:id` - Obtener transacción específica
- `PUT /api/transactions/:id` - Actualizar transacción
- `DELETE /api/transactions/:id` - Eliminar transacción
- `GET /api/transactions/summary` - Obtener resumen financiero
- `GET /api/transactions/monthly/:year/:month` - Obtener resumen mensual

#### 🏆 Logros
- `GET /api/achievements` - Obtener todos los logros
- `GET /api/achievements/user` - Obtener logros del usuario
- `POST /api/achievements/:id/unlock` - Desbloquear logro

#### 🎮 Gamificación
- `GET /api/gamification/profile` - Obtener perfil de gamificación
- `GET /api/gamification/leaderboard` - Obtener tabla de clasificación
- `GET /api/gamification/level-info` - Información de progresión de nivel
- `GET /api/gamification/stats` - Estadísticas de gamificación

### Ejemplos de Uso

#### Registrar un usuario
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario123",
    "email": "usuario@ejemplo.com",
    "password": "password123",
    "firstName": "Juan",
    "lastName": "Pérez"
  }'
```

#### Crear una transacción
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_JWT_TOKEN" \
  -d '{
    "type": "income",
    "category": "salary",
    "amount": 1000,
    "description": "Salario mensual"
  }'
```

## 🗄️ Estructura del Proyecto

```
src/
├── types/           # Definiciones de tipos TypeScript
├── models/          # Modelos de MongoDB con Mongoose
├── routes/          # Rutas de la API
├── middleware/      # Middlewares personalizados
├── config/          # Configuraciones
├── utils/           # Utilidades y helpers
├── scripts/         # Scripts de utilidad
├── tests/           # Tests y configuración
└── server.ts        # Punto de entrada principal
```

## 🗄️ Estructura de la Base de Datos

### Modelos Principales

#### User
- Información básica del usuario
- Datos de gamificación (nivel, experiencia, monedas)
- Estadísticas financieras
- Logros desbloqueados

#### Transaction
- Transacciones financieras
- Categorización automática
- Cálculo de recompensas de gamificación
- Metadatos adicionales

#### Achievement
- Sistema de logros
- Criterios de desbloqueo
- Recompensas asociadas
- Categorías y rareza

## 🎯 Sistema de Gamificación

### Experiencia y Niveles
- **Fórmula de experiencia**: Nivel × 100 puntos para subir
- **Recompensas por transacción**:
  - Ingresos: 10% del monto como experiencia
  - Ahorros: 20% del monto como experiencia
  - Gastos: 5% del monto como experiencia

### Monedas Virtuales
- **Recompensas por transacción**:
  - Ingresos: 5% del monto como monedas
  - Ahorros: 10% del monto como monedas
  - Gastos: 2% del monto como monedas

### Logros
- **Categorías**: Financiero, Ahorro, Seguimiento, Racha, Hito
- **Criterios**: Cantidad de transacciones, monto total, metas alcanzadas
- **Rareza**: Común, Raro, Épico, Legendario

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Ejecutar tests con UI
npm run test:ui

# Ejecutar tests con cobertura
npm run test:coverage
```

## 🔧 Configuración de Desarrollo

### Variables de Entorno
```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de datos
MONGODB_URI=mongodb://localhost:27017/gamification-finances

# JWT
JWT_SECRET=tu-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# API
API_VERSION=v1
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### Configuración TypeScript
- **Target**: ES2022
- **Module**: ESNext
- **Strict mode**: Habilitado
- **Path mapping**: Configurado para imports limpios

## 🚀 Despliegue

### Heroku
1. Crear aplicación en Heroku
2. Configurar variables de entorno
3. Conectar repositorio
4. Configurar build script: `npm run build`
5. Configurar start script: `npm start`

### Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Construir imagen
docker build -t gamification-finances .

# Ejecutar contenedor
docker run -p 3000:3000 gamification-finances
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si tienes alguna pregunta o problema, por favor abre un issue en el repositorio.

## 🔮 Roadmap

- [ ] Sistema de notificaciones push
- [ ] Integración con bancos
- [ ] Análisis de gastos con IA
- [ ] Sistema de amigos y grupos
- [ ] Marketplace de recompensas
- [ ] Exportación de datos
- [ ] API GraphQL
- [ ] Aplicación móvil

---

Desarrollado con ❤️ y TypeScript para hacer las finanzas personales más divertidas y efectivas. 