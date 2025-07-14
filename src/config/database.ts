import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI!);

    console.log(`📦 MongoDB conectado: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err: Error) => {
      console.error('❌ Error de conexión a MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB desconectado');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📦 Conexión a MongoDB cerrada por terminación de la aplicación');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', (error as Error).message);
    process.exit(1);
  }
}; 