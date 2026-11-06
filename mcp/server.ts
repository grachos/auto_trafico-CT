#!/usr/bin/env node

/**
 * SERVIDOR MCP (Model Context Protocol) - Auto_trafico-CT
 * Permite a cualquier IA (Claude Desktop, Antigravity, Cursor, etc.) conectarse
 * a ControlT para monitorear viajes y atender alarmas.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { dataStore } from '../lib/data-store.js';

const server = new Server(
  {
    name: 'controlt-traffic-agent',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Listado de Herramientas Disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'controlt_get_eta_summary',
        description: 'Obtiene el resumen y estado de puntualidad del Semáforo ETA (A tiempo, Tarde, Tolerancia) de la flota de viajes activos en ControlT.',
        inputSchema: {
          type: 'object',
          properties: {
            filtro_semaforo: {
              type: 'string',
              enum: ['TODOS', 'A_TIEMPO', 'TARDE', 'TOLERANCIA'],
              description: 'Filtrar por estado del semáforo ETA',
            },
          },
        },
      },
      {
        name: 'controlt_get_active_alarms',
        description: 'Consulta la cola activa de alarmas pendientes por atender en ControlT, filtradas por nivel de prioridad (Crítica, Alta, Media, Baja).',
        inputSchema: {
          type: 'object',
          properties: {
            prioridad: {
              type: 'string',
              enum: ['TODAS', 'CRITICA', 'ALTA', 'MEDIA', 'BAJA'],
              description: 'Nivel de prioridad de la alarma',
            },
          },
        },
      },
      {
        name: 'controlt_attend_alarm',
        description: 'Atiende y cierra una alarma específica en ControlT registrando la novedad seleccionada y el comentario de justificación.',
        inputSchema: {
          type: 'object',
          properties: {
            alarma_id: {
              type: 'string',
              description: 'Identificador único de la alarma en ControlT',
            },
            novedad: {
              type: 'string',
              description: 'Novedad a registrar (ej: "En ruta sin novedad alguna")',
            },
            comentario: {
              type: 'string',
              description: 'Comentario u observación detallada de la atención',
            },
          },
          required: ['alarma_id', 'novedad', 'comentario'],
        },
      },
      {
        name: 'controlt_batch_attend_on_time',
        description: 'Atiende de forma automática en lote todas las alarmas de "Llamada de seguimiento" cuyos viajes se encuentren en estado Semáforo ETA "A TIEMPO".',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// 2. Ejecución de Herramientas (Tool Handlers)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'controlt_get_eta_summary': {
        const filtro = (args?.filtro_semaforo as string) || 'TODOS';
        const metricas = dataStore.getMetricas();
        const viajes = dataStore.getViajes(filtro);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ metricas, viajesCount: viajes.length, viajes: viajes.slice(0, 10) }, null, 2),
            },
          ],
        };
      }

      case 'controlt_get_active_alarms': {
        const prioridad = (args?.prioridad as string) || 'TODAS';
        const alarmas = dataStore.getAlarmas(prioridad, true);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: alarmas.length, alarmas }, null, 2),
            },
          ],
        };
      }

      case 'controlt_attend_alarm': {
        const alarmaId = args?.alarma_id as string;
        const novedad = args?.novedad as string;
        const comentario = args?.comentario as string;

        const resultado = dataStore.atenderAlarma(alarmaId, novedad, comentario, 'MCP Agent Tool');
        if (!resultado) {
          throw new Error(`Alarma con ID ${alarmaId} no encontrada`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Alarma ${alarmaId} atendida exitosamente`, resultado }, null, 2),
            },
          ],
        };
      }

      case 'controlt_batch_attend_on_time': {
        const resultado = dataStore.atenderLoteATiempo('MCP Batch Agent');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Se atendieron ${resultado.total} alarmas a tiempo`, resultado }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error ejecutando ${name}: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 3. Inicio del Servidor vía Stdio
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Servidor MCP ControlT conectado y escuchando vía stdio.');
}

run().catch((error) => {
  console.error('Error fatal en servidor MCP:', error);
  process.exit(1);
});

