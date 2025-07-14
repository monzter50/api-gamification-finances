import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Achievement } from '../models/Achievement';

dotenv.config();

interface AchievementData {
  name: string;
  description: string;
  icon: string;
  category: 'financial' | 'savings' | 'tracking' | 'streak' | 'milestone';
  criteria: {
    type: 'transaction_count' | 'total_amount' | 'savings_goal' | 'streak_days' | 'level_reached';
    value: number;
    timeframe: 'all_time' | 'monthly' | 'weekly' | 'daily';
  };
  reward: {
    experience: number;
    coins: number;
  };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const achievements: AchievementData[] = [
  // Financial achievements
  {
    name: 'Primer Ingreso',
    description: 'Registra tu primera transacción de ingreso',
    icon: '💰',
    category: 'financial',
    criteria: {
      type: 'transaction_count',
      value: 1,
      timeframe: 'all_time'
    },
    reward: {
      experience: 50,
      coins: 25
    },
    rarity: 'common'
  },
  {
    name: 'Ahorrador Novato',
    description: 'Ahorra $100 por primera vez',
    icon: '🏦',
    category: 'savings',
    criteria: {
      type: 'total_amount',
      value: 100,
      timeframe: 'all_time'
    },
    reward: {
      experience: 100,
      coins: 50
    },
    rarity: 'common'
  },
  {
    name: 'Rastreador Consistente',
    description: 'Registra transacciones durante 7 días consecutivos',
    icon: '📊',
    category: 'tracking',
    criteria: {
      type: 'streak_days',
      value: 7,
      timeframe: 'all_time'
    },
    reward: {
      experience: 200,
      coins: 100
    },
    rarity: 'rare'
  },
  {
    name: 'Meta Alcanzada',
    description: 'Alcanza tu primera meta de ahorro',
    icon: '🎯',
    category: 'savings',
    criteria: {
      type: 'savings_goal',
      value: 1,
      timeframe: 'all_time'
    },
    reward: {
      experience: 300,
      coins: 150
    },
    rarity: 'epic'
  },
  {
    name: 'Nivel 5',
    description: 'Alcanza el nivel 5',
    icon: '⭐',
    category: 'milestone',
    criteria: {
      type: 'level_reached',
      value: 5,
      timeframe: 'all_time'
    },
    reward: {
      experience: 500,
      coins: 250
    },
    rarity: 'rare'
  },
  {
    name: 'Ahorrador Experto',
    description: 'Ahorra $1,000',
    icon: '💎',
    category: 'savings',
    criteria: {
      type: 'total_amount',
      value: 1000,
      timeframe: 'all_time'
    },
    reward: {
      experience: 1000,
      coins: 500
    },
    rarity: 'epic'
  },
  {
    name: 'Rastreador Maestro',
    description: 'Registra transacciones durante 30 días consecutivos',
    icon: '📈',
    category: 'tracking',
    criteria: {
      type: 'streak_days',
      value: 30,
      timeframe: 'all_time'
    },
    reward: {
      experience: 2000,
      coins: 1000
    },
    rarity: 'legendary'
  },
  {
    name: 'Nivel 10',
    description: 'Alcanza el nivel 10',
    icon: '🌟',
    category: 'milestone',
    criteria: {
      type: 'level_reached',
      value: 10,
      timeframe: 'all_time'
    },
    reward: {
      experience: 1500,
      coins: 750
    },
    rarity: 'epic'
  },
  {
    name: 'Ahorrador Legendario',
    description: 'Ahorra $10,000',
    icon: '👑',
    category: 'savings',
    criteria: {
      type: 'total_amount',
      value: 10000,
      timeframe: 'all_time'
    },
    reward: {
      experience: 5000,
      coins: 2500
    },
    rarity: 'legendary'
  },
  {
    name: 'Transacciones Prolíficas',
    description: 'Registra 100 transacciones',
    icon: '📝',
    category: 'tracking',
    criteria: {
      type: 'transaction_count',
      value: 100,
      timeframe: 'all_time'
    },
    reward: {
      experience: 800,
      coins: 400
    },
    rarity: 'rare'
  },
  {
    name: 'Nivel 20',
    description: 'Alcanza el nivel 20',
    icon: '🏆',
    category: 'milestone',
    criteria: {
      type: 'level_reached',
      value: 20,
      timeframe: 'all_time'
    },
    reward: {
      experience: 3000,
      coins: 1500
    },
    rarity: 'legendary'
  },
  {
    name: 'Ahorrador Millonario',
    description: 'Ahorra $100,000',
    icon: '💎👑',
    category: 'savings',
    criteria: {
      type: 'total_amount',
      value: 100000,
      timeframe: 'all_time'
    },
    reward: {
      experience: 10000,
      coins: 5000
    },
    rarity: 'legendary'
  }
];

const seedAchievements = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);

    console.log('📦 Conectado a MongoDB');

    // Clear existing achievements
    await Achievement.deleteMany({});
    console.log('🗑️ Logros existentes eliminados');

    // Insert new achievements
    const createdAchievements = await Achievement.insertMany(achievements);
    console.log(`✅ ${createdAchievements.length} logros creados exitosamente`);

    // Display created achievements
    console.log('\n📋 Logros creados:');
    createdAchievements.forEach((achievement: any) => {
      console.log(`- ${achievement.icon} ${achievement.name} (${achievement.rarity})`);
    });

    console.log('\n🎉 Base de datos poblada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error poblando la base de datos:', error);
    process.exit(1);
  }
};

// Run the seed function
seedAchievements(); 