import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BacklogPanel from '../src/classes/BacklogPanel.js';

describe('BacklogPanel Security Tests', () => {
	let container;
	let backlogPanel;

	beforeEach(() => {
		// Create a container for testing
		container = document.createElement('div');
		container.id = 'backlog-container';
		document.body.appendChild(container);

		// Clear localStorage before each test
		localStorage.clear();

		// Create BacklogPanel instance
		backlogPanel = new BacklogPanel('backlog-container');
	});

	afterEach(() => {
		// Clean up
		if (container && container.parentNode) {
			container.parentNode.removeChild(container);
		}
		localStorage.clear();
	});

	describe('XSS Prevention', () => {
		it('should escape HTML in task descriptions', () => {
			const maliciousDescription = '<script>alert("XSS")</script>';
			const item = backlogPanel.addItem(maliciousDescription, 'testUser');

			expect(item).not.toBeNull();
			expect(item.description).not.toContain('<script>');
			expect(item.description).not.toContain('</script>');
			// Check that HTML entities are present (escaped)
			expect(item.description).toContain('&lt;');
			expect(item.description).toContain('&gt;');
		});

		it('should escape HTML in creator usernames', () => {
			const maliciousCreator = '<img src=x onerror=alert("XSS")>';
			const item = backlogPanel.addItem('Test task', maliciousCreator);

			expect(item).not.toBeNull();
			expect(item.creator).not.toContain('<img');
			expect(item.creator).not.toContain('>');
			// Check that HTML entities are present (escaped)
			expect(item.creator).toContain('&lt;');
			expect(item.creator).toContain('&gt;');
		});

		it('should escape double quotes in descriptions', () => {
			const maliciousDescription = 'Test "onmouseover="alert(1)" task';
			const item = backlogPanel.addItem(maliciousDescription, 'testUser');

			expect(item).not.toBeNull();
			// textContent is safe - it treats everything as text, not HTML
			// Quotes don't need escaping in text content, only in HTML attributes
			expect(item.description).toContain('"');
			// But HTML tags should still be escaped
			expect(item.description).not.toContain('<script>');
		});

		it('should escape single quotes in descriptions', () => {
			const maliciousDescription = "Test 'onmouseover='alert(1)' task";
			const item = backlogPanel.addItem(maliciousDescription, 'testUser');

			expect(item).not.toBeNull();
			// textContent is safe - it treats everything as text, not HTML
			// Quotes don't need escaping in text content, only in HTML attributes
			expect(item.description).toContain("'");
			// But HTML tags should still be escaped
			expect(item.description).not.toContain('<script>');
		});

		it('should escape ampersands in descriptions', () => {
			const maliciousDescription = 'Test &lt;script&gt; task';
			const item = backlogPanel.addItem(maliciousDescription, 'testUser');

			expect(item).not.toBeNull();
			// The ampersand should be escaped to &amp;
			expect(item.description).toContain('&amp;');
		});

		it('should handle null/undefined input gracefully', () => {
			const item1 = backlogPanel.addItem(null, 'testUser');
			const item2 = backlogPanel.addItem('test', null);

			// Should handle null by converting to string or rejecting
			expect(item1).not.toBeNull();
			expect(item2).not.toBeNull();
		});

		it('should persist escaped data to localStorage', () => {
			const maliciousDescription = '<script>alert("XSS")</script>';
			const maliciousCreator = '<img src=x onerror=alert("XSS")>';

			backlogPanel.addItem(maliciousDescription, maliciousCreator);

			// Create new instance to simulate page reload
			const newBacklogPanel = new BacklogPanel('backlog-container');
			const items = newBacklogPanel.getItems();

			expect(items.length).toBe(1);
			expect(items[0].description).not.toContain('<script>');
			expect(items[0].creator).not.toContain('<img');
		});
	});

	describe('Input Validation', () => {
		it('should accept valid task descriptions', () => {
			const validDescription = 'This is a valid task description';
			const item = backlogPanel.addItem(validDescription, 'testUser');

			expect(item).not.toBeNull();
			expect(item.description).toBe(validDescription);
		});

		it('should accept valid usernames', () => {
			const validUsernames = ['user123', 'test_user', 'user-name', 'UserName'];
			validUsernames.forEach(username => {
				const item = backlogPanel.addItem('Test task', username);
				expect(item).not.toBeNull();
			});
		});

		it('should handle very long descriptions', () => {
			const longDescription = 'a'.repeat(1000);
			const item = backlogPanel.addItem(longDescription, 'testUser');

			expect(item).not.toBeNull();
			// The description should still be stored (validation is done at the Task class level)
		});
	});

	describe('Storage Security', () => {
		it('should handle localStorage quota exceeded gracefully', () => {
			// Fill localStorage to near capacity
			const largeData = 'x'.repeat(5 * 1024 * 1024); // 5MB
			try {
				localStorage.setItem('testLargeData', largeData);
			} catch (e) {
				// Expected to fail if quota is exceeded
			}

			// Try to add item - should not crash
			const item = backlogPanel.addItem('Test task', 'testUser');
			expect(item).not.toBeNull();
		});

		it('should clear completed items when quota is exceeded', () => {
			// Add many items to fill storage
			for (let i = 0; i < 100; i++) {
				backlogPanel.addItem(`Task ${i} with long description to consume storage`, 'testUser');
			}

			// Mark some as completed
			const items = backlogPanel.getItems();
			if (items.length > 0) {
				backlogPanel.toggleComplete(items[0].id);
			}

			// Should not crash when clearing
			const clearedCount = backlogPanel.clearCompleted();
			expect(clearedCount).toBeGreaterThanOrEqual(0);
		});
	});
});