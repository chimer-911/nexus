import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactFlow, { Background, Controls } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
  {
    id: 'input',
    type: 'custom',
    position: { x: 50, y: 200 },
    data: { label: 'User Request' },
    className: 'react-flow__node-custom border-neon-blue',
  },
  {
    id: 'router',
    type: 'custom',
    position: { x: 300, y: 200 },
    data: { label: 'PRISM Router\n(Xenova/all-MiniLM)' },
    className: 'react-flow__node-custom border-neon-purple',
  },
  {
    id: 'agent1',
    type: 'custom',
    position: { x: 600, y: 50 },
    data: { label: 'Research Agent\n(GPT-4o)' },
    className: 'react-flow__node-custom border-gray-500',
  },
  {
    id: 'agent2',
    type: 'custom',
    position: { x: 600, y: 200 },
    data: { label: 'Analysis Agent\n(Claude Opus 4)' },
    className: 'react-flow__node-custom border-yellow-500',
  },
  {
    id: 'agent3',
    type: 'custom',
    position: { x: 600, y: 350 },
    data: { label: 'Code Agent\n(DeepSeek R1)' },
    className: 'react-flow__node-custom border-neon-green',
  },
  {
    id: 'output',
    type: 'custom',
    position: { x: 900, y: 200 },
    data: { label: 'Final Output' },
    className: 'react-flow__node-custom border-neon-blue text-glow',
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'input', target: 'router', animated: true },
  { id: 'e2', source: 'router', target: 'agent1', animated: true },
  { id: 'e3', source: 'router', target: 'agent2', animated: true },
  { id: 'e4', source: 'router', target: 'agent3', animated: true },
  { id: 'e5', source: 'agent1', target: 'output', animated: true },
  { id: 'e6', source: 'agent2', target: 'output', animated: true },
  { id: 'e7', source: 'agent3', target: 'output', animated: true },
];

export default function App() {
  const [swarm, setSwarm] = useState({ nodes: [], edges: [] });
  useEffect(() => {
    const fetchInterval = setInterval(() => {
      fetch('/api/swarm').then(r => r.json()).then(data => {
        if(data && !data.error) setSwarm(data);
      }).catch(() => {});
    }, 1000);
    return () => clearInterval(fetchInterval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col p-6"
    >
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Swarm Orchestrator</h2>
          <p className="text-gray-400">Live multi-agent execution topology</p>
        </div>
        <div className="flex gap-4">
          <div className="glass-panel px-4 py-2 rounded-lg flex flex-col">
            <span className="text-xs text-gray-400">Active Agents</span>
            <span className="text-xl font-mono text-neon-blue">14</span>
          </div>
          <div className="glass-panel px-4 py-2 rounded-lg flex flex-col">
            <span className="text-xs text-gray-400">Total Tokens</span>
            <span className="text-xl font-mono text-neon-purple text-glow-purple">1.2M</span>
          </div>
        </div>
      </header>

      <div className="flex-1 glass-panel rounded-2xl overflow-hidden relative border-white/10 shadow-[0_0_30px_rgba(96,165,250,0.1)]">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <span className="px-3 py-1 text-xs font-mono bg-neon-green/10 text-neon-green border border-neon-green/30 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
            Execution Live
          </span>
        </div>
        <ReactFlow
          nodes={swarm.nodes.length > 0 ? swarm.nodes : initialNodes}
          edges={swarm.edges.length > 0 ? swarm.edges : initialEdges}
          fitView
          className="bg-transparent"
        >
          <Background color="#4b5563" gap={16} />
          <Controls className="glass-panel border-none fill-white text-black" />
        </ReactFlow>
      </div>
    </motion.div>
  );
}
