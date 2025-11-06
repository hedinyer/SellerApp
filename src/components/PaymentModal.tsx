import { useState } from 'react'
import { useConfig } from '../contexts/ConfigContext'

interface OrderItem {
  name: string
  quantity: number
  price: number
  notes?: string
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  tableData: {
    number: number
    orderTotal?: number
    orderDetails?: OrderItem[]
    timeOccupied: string
    guests: number
  }
  onProcessPayment: (method: string) => void
}

const PaymentMethods = [
  {
    id: 'qr',
    name: 'Pago QR',
    icon: <img src="./qr-code.png" alt="QR" className="w-6 h-6" />,
    description: 'Pago con QR'
  },
  {
    id: 'card',
    name: 'Tarjeta',
    icon: <img src="./credit-cards.png" alt="Tarjeta" className="w-6 h-6" />,
    description: 'Débito o Crédito'
  },
  {
    id: 'cash',
    name: 'Efectivo',
    icon: <img src="./money.png" alt="Efectivo" className="w-6 h-6" />,
    description: 'Pago en efectivo'
  }
]

export function PaymentModal({ isOpen, onClose, tableData, onProcessPayment }: PaymentModalProps) {
  const { t, formatCurrency } = useConfig()
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen) return null

  const handlePayment = async () => {
    if (!selectedMethod) return
    
    setIsProcessing(true)
    // Aquí iría la lógica real de procesamiento de pago
    await new Promise(resolve => setTimeout(resolve, 1500)) // Simulación de proceso
    onProcessPayment(selectedMethod)
    setIsProcessing(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[8px] shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              Mesa {tableData.number}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {tableData.timeOccupied} • {tableData.guests} personas
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Order Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Resumen del Pedido</h3>
            <div className="space-y-2">
              {(tableData.orderDetails || []).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium">
                      {item.quantity}
                    </span>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-gray-600 font-medium">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-base font-medium text-gray-700">Total</span>
                <span className="text-xl font-semibold text-gray-800">
                  {formatCurrency(tableData.orderTotal || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Método de Pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {PaymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`w-full p-3 rounded-[10px] border transition-all flex items-center space-x-3 ${
                    selectedMethod === method.id
                      ? 'border-blue-400 bg-blue-50/50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/30'
                  }`}
                >
                  <div className="flex-shrink-0 opacity-70">
                    {method.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-800 text-sm">{method.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handlePayment}
              disabled={!selectedMethod || isProcessing}
              className={`px-5 py-2 rounded-lg font-medium text-white transition-all ${
                !selectedMethod || isProcessing
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Procesando...</span>
                </span>
              ) : (
                'Procesar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 