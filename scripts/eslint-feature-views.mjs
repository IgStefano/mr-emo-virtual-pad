export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary:
        'UI002: move behavioral control flow, asynchronous work and state into mutation-covered renderer .ts modules; keep TSX to rendering and event binding.',
    },
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: 'boundary' });
    return {
      ImportDeclaration(node) {
        if (
          node.source.value === 'react' &&
          node.importKind !== 'type' &&
          node.specifiers.some((specifier) => specifier.importKind !== 'type')
        )
          report(node);
      },
      'ConditionalExpression, LogicalExpression'(node) {
        const ancestors = context.sourceCode.getAncestors(node);
        const attribute = ancestors.findLastIndex(
          (ancestor) =>
            ancestor.type === 'JSXAttribute' &&
            ancestor.name.type === 'JSXIdentifier' &&
            /^on[A-Z]/u.test(ancestor.name.name),
        );
        const callback = ancestors
          .slice(attribute + 1)
          .some((ancestor) =>
            ['ArrowFunctionExpression', 'FunctionExpression'].includes(
              ancestor.type,
            ),
          );
        if (attribute >= 0 && callback) report(node);
      },
      ':function'(node) {
        if (node.async || node.generator) report(node);
      },
      'AwaitExpression, IfStatement, SwitchStatement, TryStatement, ThrowStatement, ForStatement, ForOfStatement, ForInStatement, WhileStatement, DoWhileStatement, AssignmentExpression, UpdateExpression':
        report,
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Promise')
          report(node);
      },
      YieldExpression: report,
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'Identifier' &&
          [
            'useState',
            'useReducer',
            'useEffect',
            'useLayoutEffect',
            'setTimeout',
            'setInterval',
            'queueMicrotask',
            'requestAnimationFrame',
          ].includes(callee.name)
        )
          report(node);
        if (
          callee.type === 'MemberExpression' &&
          ['then', 'catch', 'finally'].includes(
            callee.property.type === 'Identifier'
              ? callee.property.name
              : callee.property.type === 'Literal'
                ? callee.property.value
                : '',
          )
        )
          report(node);
      },
    };
  },
};
