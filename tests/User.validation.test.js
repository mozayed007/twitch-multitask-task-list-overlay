import { describe, it, expect } from 'vitest';
import User from '../src/classes/User.js';
import Task from '../src/classes/Task.js';

describe('User Input Validation Tests', () => {
	describe('Username Validation', () => {
		it('should accept valid usernames', () => {
			const validUsernames = [
				'username',
				'user123',
				'test_user',
				'user-name',
				'UserName',
				'USER123',
				'a1b2c3'
			];

			validUsernames.forEach(username => {
				const user = new User(username, { userColor: '#ffffff' });
				expect(user.username).toBe(username);
			});
		});

		it('should reject usernames that are too short', () => {
			const shortUsernames = ['', 'ab', 'a'];

			shortUsernames.forEach(username => {
				expect(() => {
					new User(username, { userColor: '#ffffff' });
				}).toThrow();
			});
		});

		it('should reject usernames that are too long', () => {
			const longUsername = 'a'.repeat(26);

			expect(() => {
				new User(longUsername, { userColor: '#ffffff' });
			}).toThrow('Username must be between 3 and 25 characters');
		});

		it('should reject usernames with invalid characters', () => {
			const invalidUsernames = [
				'user@name',
				'user.name',
				'user name',
				'user#name',
				'user$name',
				'user%name',
				'user!name'
			];

			invalidUsernames.forEach(username => {
				expect(() => {
					new User(username, { userColor: '#ffffff' });
				}).toThrow('Username can only contain letters, numbers, underscores, and hyphens');
			});
		});

		it('should reject usernames with XSS characters', () => {
			const xssUsernames = [
				'<script>alert("XSS")</script>',
				'<img src=x onerror=alert(1)>',
				'user"onmouseover="alert(1)',
				"user'onmouseover='alert(1)",
				'user&xss=attack'
			];

			xssUsernames.forEach(username => {
				expect(() => {
					new User(username, { userColor: '#ffffff' });
				}).toThrow();
			});
		});

		it('should reject non-string usernames', () => {
			const invalidTypes = [null, undefined, 123, {}, [], true];

			invalidTypes.forEach(username => {
				expect(() => {
					new User(username, { userColor: '#ffffff' });
				}).toThrow('Username must be of type string');
			});
		});

		it('should trim whitespace from usernames', () => {
			const user = new User('  username  ', { userColor: '#ffffff' });
			expect(user.username).toBe('username');
		});
	});

	describe('Task Description Validation', () => {
		it('should accept valid task descriptions', () => {
			const validDescriptions = [
				'Complete homework',
				'Read chapter 5',
				'Write code for feature X',
				'Test the application',
				'a'.repeat(500) // Maximum length
			];

			validDescriptions.forEach(description => {
				const task = new Task(description);
				expect(task.description).toBe(description);
			});
		});

		it('should reject empty task descriptions', () => {
			const emptyDescriptions = ['', '   ', '\t', '\n'];

			emptyDescriptions.forEach(description => {
				expect(() => {
					new Task(description);
				}).toThrow('Task description must be between 1 and 500 characters');
			});
		});

		it('should reject task descriptions that are too long', () => {
			const longDescription = 'a'.repeat(501);

			expect(() => {
				new Task(longDescription);
			}).toThrow('Task description must be between 1 and 500 characters');
		});

		it('should reject task descriptions with XSS characters', () => {
			const xssDescriptions = [
				'<script>alert("XSS")</script>',
				'<img src=x onerror=alert(1)>',
				'task"onmouseover="alert(1)',
				"task'onmouseover='alert(1)",
				'task&xss=attack'
			];

			xssDescriptions.forEach(description => {
				expect(() => {
					new Task(description);
				}).toThrow('Task description contains invalid characters');
			});
		});

		it('should reject non-string task descriptions', () => {
			const invalidTypes = [null, undefined, 123, {}, [], true];

			invalidTypes.forEach(description => {
				expect(() => {
					new Task(description);
				}).toThrow('Task description must be of type string');
			});
		});

		it('should trim whitespace from task descriptions', () => {
			const task = new Task('  Complete homework  ');
			expect(task.description).toBe('Complete homework');
		});

		it('should accept task descriptions with special safe characters', () => {
			const safeDescriptions = [
				'Complete homework by 5pm',
				'Read chapter 5-10',
				'Write code for feature X (priority: high)',
				'Test the application: user login',
				'Review PR #123'
			];

			safeDescriptions.forEach(description => {
				const task = new Task(description);
				expect(task.description).toBe(description);
			});
		});
	});

	describe('Task ID Generation', () => {
		it('should generate unique task IDs', () => {
			const task1 = new Task('Task 1');
			const task2 = new Task('Task 2');

			expect(task1.id).not.toBe(task2.id);
		});

		it('should generate string IDs', () => {
			const task = new Task('Test task');
			expect(typeof task.id).toBe('string');
		});

		it('should generate IDs with reasonable length', () => {
			const task = new Task('Test task');
			expect(task.id.length).toBeGreaterThan(10);
			expect(task.id.length).toBeLessThan(50);
		});
	});
});