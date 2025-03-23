"use client";

interface Param {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
}

interface ParamTableProps {
  params: Param[];
  title?: string;
}

export default function ParamTable({ params, title = "Parameters" }: ParamTableProps) {
  return (
    <div className="my-6">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div className="overflow-x-auto shadow-sm rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Parameter
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Required
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {params.map((param, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                  {param.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                  {param.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {param.required !== false ? (
                    <span className="text-green-500 font-medium">Yes</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                  {!param.required && param.defaultValue && (
                    <span className="text-gray-400 ml-1">
                      (Default: <code className="text-xs bg-gray-100 p-1 rounded">{param.defaultValue}</code>)
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {param.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}