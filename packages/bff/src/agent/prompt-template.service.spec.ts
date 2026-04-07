import { PromptTemplateService, AgentType } from './prompt-template.service';

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;

  beforeEach(() => {
    service = new PromptTemplateService();
  });

  describe('getSystemPrompt', () => {
    it.each<AgentType>(['analyst', 'content', 'action', 'yield'])(
      'returns system prompt for %s',
      (agentType) => {
        const prompt = service.getSystemPrompt(agentType);
        expect(prompt).toBeDefined();
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
      },
    );

    it('throws for unknown agent type', () => {
      expect(() => service.getSystemPrompt('unknown' as AgentType)).toThrow(
        'Unknown agent type: unknown',
      );
    });
  });

  describe('getTemplate', () => {
    it('returns template for content:email', () => {
      const tpl = service.getTemplate('content', 'email');
      expect(tpl).toContain('Subject:');
    });

    it('throws for unknown template', () => {
      expect(() => service.getTemplate('content', 'nonexistent')).toThrow(
        'Unknown template: content:nonexistent',
      );
    });
  });

  describe('render', () => {
    it('replaces template variables', () => {
      const result = service.render('Hello {{name}}, welcome to {{place}}!', {
        name: 'Alice',
        place: 'Web3',
      });
      expect(result).toBe('Hello Alice, welcome to Web3!');
    });

    it('leaves unmatched placeholders as-is', () => {
      const result = service.render('Hello {{name}}, your {{role}} awaits', {
        name: 'Bob',
      });
      expect(result).toBe('Hello Bob, your {{role}} awaits');
    });

    it('handles template with no variables', () => {
      const result = service.render('No variables here', { foo: 'bar' });
      expect(result).toBe('No variables here');
    });
  });
});
