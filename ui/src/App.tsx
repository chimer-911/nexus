import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactFlow, { Background, Controls } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';





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
          nodes={swarm?.nodes || []}
          edges={swarm?.edges || []}
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
