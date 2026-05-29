import { motion } from 'motion/react';
import { memo } from 'react';
import { ContentNode } from '../data/content';
import {
  DEFAULT_VISUAL_STYLE,
  type AppVisualStyle,
} from '../../shared/visualStyle';

interface ContentViewProps {
  node: ContentNode;
  relatedNodes: ContentNode[];
  onSelectRelated: (node: ContentNode) => void;
  visualStyle?: AppVisualStyle;
}

export const ContentView = memo(function ContentView({
  node,
  relatedNodes,
  onSelectRelated,
  visualStyle = DEFAULT_VISUAL_STYLE,
}: ContentViewProps) {
  const isVector = visualStyle === 'kurzgesagt';

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Main content planet/card */}
      <div className="relative z-50 pointer-events-auto">
        <div
          className={`content-card w-[600px] ${isVector ? '' : `bg-gradient-to-br ${node.gradient} shadow-2xl`} rounded-lg p-12 relative overflow-hidden`}
          style={{
            backgroundColor: isVector ? node.color : undefined,
            boxShadow: isVector ? undefined : `0 0 100px ${node.color}40, 0 20px 60px rgba(0,0,0,0.4)`
          }}
        >
          {/* Glassy overlay */}
          {!isVector && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
          )}
          {isVector && (
            <>
              <div className="vector-card-shape vector-card-shape--one" />
              <div className="vector-card-shape vector-card-shape--two" />
            </>
          )}

          <div className="relative z-10">
            <h1 className="content-card-title text-5xl font-bold text-white mb-6 drop-shadow-lg">
              {node.title}
            </h1>

            {node.content?.intro && (
              <p className="content-card-copy text-xl text-white/90 mb-8 leading-relaxed">
                {node.content.intro}
              </p>
            )}

            {/* Related items section */}
            {node.content?.relatedItems && node.content.relatedItems.length > 0 && (
              <div className="content-card-related mt-8 pt-8 border-t border-white/20">
                <h3 className="text-lg font-semibold text-white/80 mb-4">
                  Related Topics
                </h3>
                <div className="flex flex-wrap gap-3">
                  {node.content.relatedItems.map((item, index) => (
                    <div
                      key={index}
                      className="content-card-chip px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Atmospheric glow */}
          {!isVector && (
            <div
              className="absolute inset-0 rounded-lg opacity-30 blur-2xl pointer-events-none"
              style={{ background: `radial-gradient(circle at 30% 30%, ${node.color}60, transparent 70%)` }}
            />
          )}
        </div>
      </div>

      {/* Related nodes orbit (smaller) */}
      {relatedNodes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {relatedNodes.slice(0, 4).map((relatedNode, index) => {
            const angle = (index / Math.min(relatedNodes.length, 4)) * Math.PI * 2 - Math.PI / 2;
            const radius = 450;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <motion.div
                key={relatedNode.id}
                className="absolute left-1/2 top-1/2 pointer-events-auto cursor-pointer group"
                style={{
                  x: x - 40,
                  y: y - 40
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.7 }}
                whileHover={{ scale: 1.1, opacity: 1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                onClick={() => onSelectRelated(relatedNode)}
              >
                <div
                  className={`related-node-button w-20 h-20 rounded-full ${isVector ? '' : `bg-gradient-to-br ${relatedNode.gradient} shadow-lg`} flex items-center justify-center`}
                  style={{
                    backgroundColor: isVector ? relatedNode.color : undefined,
                    boxShadow: isVector ? undefined : `0 0 20px ${relatedNode.color}40`
                  }}
                >
                  {!isVector && <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent" />}
                  <p className="related-node-label text-white text-xs font-semibold text-center px-2 relative z-10">
                    {relatedNode.title.split(' ')[0]}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
});
