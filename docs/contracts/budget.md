# Contratos de Servicios - Budget Module

Base URL: `/api/budgets`

## Interfaces TypeScript (Frontend)

Estos son los tipos que debería usar el Frontend para interactuar con la API.

```typescript
// Tipos de Ingreso permitidos
export type IncomeType = 
  | 'Debit Card' 
  | 'Credit Card' 
  | 'Cash' 
  | 'Vales' 
  | 'Transfer' 
  | 'Check' 
  | 'Other';

// Item de Ingreso
export interface IncomeItem {
  _id?: string; // Presente en respuestas, opcional en creación
  description: string;
  amount: number;
  type: IncomeType;
}

// Item de Gasto
export interface ExpenseItem {
  _id?: string; // Presente en respuestas, opcional en creación
  description: string;
  amount: number;
}

// Objeto Presupuesto (Budget)
export interface Budget {
  _id: string;
  userId: string;
  year: number;
  month: number; // 0-11
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
  // Propiedades calculadas (Virtuals)
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
}

// Respuesta Genérica de la API
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errorCode?: string;
  statusCode?: number;
  errors?: any[]; // Validaciones fallidas
}
```

## Endpoints

### 1. Obtener Estadísticas de Usuario
**GET** `/api/budgets/stats`

*   **Headers**: `Authorization: Bearer <token>`
*   **Query Params**: Ninguno
*   **Respuesta Exitosa (200)**:
    ```typescript
    {
      success: true,
      message: "Budget statistics retrieved successfully",
      data: {
        totalBudgets: number;
        totalIncomeAllTime: number;
        totalExpenseAllTime: number;
        averageSavingsRate: number;
        // ... otras estadísticas
      }
    }
    ```

### 2. Listar Presupuestos
**GET** `/api/budgets`

*   **Headers**: `Authorization: Bearer <token>`
*   **Query Params**:
    *   `year` (opcional): number (2000-2100)
    *   `month` (opcional): number (0-11)
*   **Respuesta Exitosa (200)**:
    ```typescript
    {
      success: true,
      message: "Budgets retrieved successfully",
      data: Budget[]
    }
    ```

### 3. Obtener Presupuesto por ID
**GET** `/api/budgets/:id`

*   **Params**: `id` (Mongo ObjectId)
*   **Respuesta Exitosa (200)**:
    ```typescript
    {
      success: true,
      message: "Budget retrieved successfully",
      data: Budget
    }
    ```

### 4. Crear Nuevo Presupuesto
**POST** `/api/budgets`

*   **Body**:
    ```typescript
    {
      year: number;       // Requerido (2000-2100)
      month: number;      // Requerido (0-11)
      incomeItems?: Array<{
        description: string;
        amount: number;
        type: IncomeType;
      }>;
      expenseItems?: Array<{
        description: string;
        amount: number;
      }>;
    }
    ```
*   **Respuesta Exitosa (201)**:
    ```typescript
    {
      success: true,
      message: "Budget created successfully",
      data: Budget
    }
    ```

### 5. Actualizar Presupuesto (Completo)
**PUT** `/api/budgets/:id`

*   **Params**: `id`
*   **Body** (Todos opcionales pero reemplazan el valor si se envían):
    ```typescript
    {
      year?: number;
      month?: number;
      incomeItems?: IncomeItem[];   // Reemplaza toda la lista si se envía
      expenseItems?: ExpenseItem[]; // Reemplaza toda la lista si se envía
    }
    ```
*   **Respuesta Exitosa (200)**: Devuelve el presupuesto actualizado.

### 6. Eliminar Presupuesto
**DELETE** `/api/budgets/:id`

*   **Respuesta Exitosa (200)**: `success: true`

---

## Rutas Anidadas de Ingresos (Incomes)

### 7. Agregar un Item de Ingreso
**POST** `/api/budgets/:id/income`

*   **Body**:
    ```typescript
    {
      description: string; // Requerido
      amount: number;      // Requerido, > 0
      type: IncomeType;    // Requerido
    }
    ```
*   **Respuesta (201)**: Devuelve el presupuesto actualizado (`data: Budget`).

### 8. Actualizar Todos los Ingresos (Reemplazo masivo)
**PATCH** `/api/budgets/:id/income`

*   **Body**:
    ```typescript
    {
      incomeItems: IncomeItem[]; // Array completo, reemplaza los existentes
    }
    ```

### 9. Eliminar Item de Ingreso
**DELETE** `/api/budgets/:id/income/:itemId`

*   **Params**: `id` (Budget ID), `itemId` (Income Item ID)

---

## Rutas Anidadas de Gastos (Expenses)

### 10. Agregar un Item de Gasto
**POST** `/api/budgets/:id/expense`

*   **Body**:
    ```typescript
    {
      description: string; // Requerido
      amount: number;      // Requerido, > 0
    }
    ```

### 11. Actualizar Todos los Gastos (Reemplazo masivo)
**PATCH** `/api/budgets/:id/expense`

*   **Body**:
    ```typescript
    {
      expenseItems: ExpenseItem[]; // Array completo, reemplaza los existentes
    }
    ```

### 12. Eliminar Item de Gasto
**DELETE** `/api/budgets/:id/expense/:itemId`

*   **Params**: `id` (Budget ID), `itemId` (Expense Item ID)
