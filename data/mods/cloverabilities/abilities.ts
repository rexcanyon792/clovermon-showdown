export const Abilities: {[k: string]: ModdedAbilityData} = {
	damp: {
		inherit: true,
		onAnyDamage(damage, target, source, effect) {
			if (effect && (effect.id === 'aftermath' || effect.id === 'ability:aftermath')) {
				return false;
			}
		},
	},
	flowerveil: {
		inherit: true,
		onAllySetStatus(status, target, source, effect) {
			if (target.hasType('Grass') && source && target !== source && effect && effect.id !== 'yawn') {
				this.debug('interrupting setStatus with Flower Veil');
				if (effect.id.endsWith('synchronize') || (effect.effectType === 'Move' && !effect.secondaries)) {
					const effectHolder = this.effectState.target;
					this.add('-block', target, 'ability: Flower Veil', '[of] ' + effectHolder);
				}
				return null;
			}
		},
	},
	innerfocus: {
		inherit: true,
		onTryBoost(boost, target, source, effect) {
			if (effect.id === 'intimidate' || effect.id === 'ability:intimidate') {
				delete boost.atk;
				this.add('-fail', target, 'unboost', 'Attack', '[from] ability: Inner Focus', '[of] ' + target);
			}
		},
	},
	mirrorarmor: {
		inherit: true,
		onTryBoost(boost, target, source, effect) {
			// Don't bounce self stat changes, or boosts that have already bounced
			if (target === source || !boost || effect.id === 'mirrorarmor' || effect.id === 'ability:mirrorarmor') return;
			let b: BoostID;
			for (b in boost) {
				if (boost[b]! < 0) {
					if (target.boosts[b] === -6) continue;
					const negativeBoost: SparseBoostsTable = {};
					negativeBoost[b] = boost[b];
					delete boost[b];
					this.add('-ability', target, 'Mirror Armor');
					this.boost(negativeBoost, source, target, null, true);
				}
			}
		},
	},
	mummy: {
		inherit: true,
		onDamagingHit(damage, target, source, move) {
			if (target.ability === 'mummy') {
				const sourceAbility = source.getAbility();
				if (sourceAbility.isPermanent || sourceAbility.id === 'mummy') {
					return;
				}
				if (move.flags['contact']) {
					const oldAbility = source.setAbility('mummy', target);
					if (oldAbility) {
						this.add('-activate', target, 'ability: Mummy', this.dex.abilities.get(oldAbility).name, '[of] ' + source);
					}
				}
			} else {
				const possibleAbilities = [source.ability, ...(source.m.innates || [])]
					.filter(val => !this.dex.abilities.get(val).isPermanent && val !== 'mummy');
				if (!possibleAbilities.length) return;
				if (move.flags['contact']) {
					const abil = this.sample(possibleAbilities);
					if (abil === source.ability) {
						const oldAbility = source.setAbility('mummy', target);
						if (oldAbility) {
							this.add('-activate', target, 'ability: Mummy', this.dex.abilities.get(oldAbility).name, '[of] ' + source);
						}
					} else {
						source.removeVolatile('ability:' + abil);
						source.addVolatile('ability:mummy', source);
					}
				}
			}
		},
	},
	neutralizinggas: {
		inherit: true,
		// Ability suppression implemented in sim/pokemon.ts:Pokemon#ignoringAbility
		onPreStart(pokemon) {
			this.add('-ability', pokemon, 'Neutralizing Gas');
			pokemon.abilityState.ending = false;
			// Remove setter's innates before the ability starts
			if (pokemon.m.innates) {
				for (const innate of pokemon.m.innates) {
					if (this.dex.abilities.get(innate).isPermanent || innate === 'neutralizinggas') continue;
					pokemon.removeVolatile('ability:' + innate);
				}
			}
			for (const target of this.getAllActive()) {
				if (target.illusion) {
					this.singleEvent('End', this.dex.abilities.get('Illusion'), target.abilityState, target, pokemon, 'neutralizinggas');
				}
				if (target.volatiles['slowstart']) {
					delete target.volatiles['slowstart'];
					this.add('-end', target, 'Slow Start', '[silent]');
				}
				if (target.m.innates) {
					for (const innate of target.m.innates) {
						if (this.dex.abilities.get(innate).isPermanent) continue;
						target.removeVolatile('ability:' + innate);
					}
				}
			}
		},
		onEnd(source) {
			this.add('-end', source, 'ability: Neutralizing Gas');

			// FIXME this happens before the pokemon switches out, should be the opposite order.
			// Not an easy fix since we cant use a supported event. Would need some kind of special event that
			// gathers events to run after the switch and then runs them when the ability is no longer accessible.
			// (If you're tackling this, do note extreme weathers have the same issue)

			// Mark this pokemon's ability as ending so Pokemon#ignoringAbility skips it
			if (source.abilityState.ending) return;
			source.abilityState.ending = true;
			const sortedActive = this.getAllActive();
			this.speedSort(sortedActive);
			for (const pokemon of sortedActive) {
				if (pokemon !== source) {
					// Will be suppressed by Pokemon#ignoringAbility if needed
					this.singleEvent('Start', pokemon.getAbility(), pokemon.abilityState, pokemon);
					if (pokemon.m.innates) {
						for (const innate of pokemon.m.innates) {
							// permanent abilities
							if (pokemon.volatiles['ability:' + innate]) continue;
							pokemon.addVolatile('ability:' + innate, pokemon);
						}
					}
				}
			}
		},
	},
	oblivious: {
		inherit: true,
		onTryBoost(boost, target, source, effect) {
			if (effect.id === 'intimidate' || effect.id === 'ability:intimidate') {
				delete boost.atk;
				this.add('-fail', target, 'unboost', 'Attack', '[from] ability: Oblivious', '[of] ' + target);
			}
		},
	},
	owntempo: {
		inherit: true,
		onTryBoost(boost, target, source, effect) {
			if (effect.id === 'intimidate' || effect.id === 'ability:intimidate') {
				delete boost.atk;
				this.add('-fail', target, 'unboost', 'Attack', '[from] ability: Own Tempo', '[of] ' + target);
			}
		},
	},
	powerofalchemy: {
		inherit: true,
		onAllyFaint(ally) {
			const pokemon = this.effectState.target;
			if (!pokemon.hp) return;
			const isAbility = pokemon.ability === 'powerofalchemy';
			let possibleAbilities = [ally.ability];
			if (ally.m.innates) possibleAbilities.push(...ally.m.innates);
			const additionalBannedAbilities = [
				'noability', 'flowergift', 'forecast', 'hungerswitch', 'illusion', 'imposter', 'neutralizinggas', 'powerofalchemy', 'receiver', 'trace', 'wonderguard', pokemon.ability, ...(pokemon.m.innates || []),
			];
			possibleAbilities = possibleAbilities
				.filter(val => !this.dex.abilities.get(val).isPermanent && !additionalBannedAbilities.includes(val));
			if (!possibleAbilities.length) return;
			const ability = this.dex.abilities.get(possibleAbilities[this.random(possibleAbilities.length)]);
			this.add('-ability', pokemon, ability, '[from] ability: Power of Alchemy', '[of] ' + ally);
			if (isAbility) {
				pokemon.setAbility(ability);
			} else {
				pokemon.removeVolatile("ability:powerofalchemy");
				pokemon.addVolatile("ability:" + ability, pokemon);
			}
		},
	},
	rattled: {
		inherit: true,
		onAfterBoost(boost, target, source, effect) {
			if (effect && (effect.id === 'intimidate' || effect.id === 'ability:intimidate')) {
				this.boost({spe: 1});
			}
		},
	},
	receiver: {
		inherit: true,
		onAllyFaint(ally) {
			const pokemon = this.effectState.target;
			if (!pokemon.hp) return;
			const isAbility = pokemon.ability === 'receiver';
			let possibleAbilities = [ally.ability];
			if (ally.m.innates) possibleAbilities.push(...ally.m.innates);
			const additionalBannedAbilities = [
				'noability', 'flowergift', 'forecast', 'hungerswitch', 'illusion', 'imposter', 'neutralizinggas', 'powerofalchemy', 'receiver', 'trace', 'wonderguard', pokemon.ability, ...(pokemon.m.innates || []),
			];
			possibleAbilities = possibleAbilities
				.filter(val => !this.dex.abilities.get(val).isPermanent && !additionalBannedAbilities.includes(val));
			if (!possibleAbilities.length) return;
			const ability = this.dex.abilities.get(possibleAbilities[this.random(possibleAbilities.length)]);
			this.add('-ability', pokemon, ability, '[from] ability: Receiver', '[of] ' + ally);
			if (isAbility) {
				pokemon.setAbility(ability);
			} else {
				pokemon.removeVolatile("ability:receiver");
				pokemon.addVolatile("ability:" + ability, pokemon);
			}
		},
	},
	scrappy: {
		inherit: true,
		onTryBoost(boost, target, source, effect) {
			if (effect.id === 'intimidate' || effect.id === 'ability:intimidate') {
				delete boost.atk;
				this.add('-fail', target, 'unboost', 'Attack', '[from] ability: Scrappy', '[of] ' + target);
			}
		},
	},
	trace: {
		inherit: true,
		onUpdate(pokemon) {
			if (!pokemon.isStarted) return;
			const isAbility = pokemon.ability === 'trace';
			const possibleTargets: Pokemon[] = [];
			for (const target of pokemon.side.foe.active) {
				if (target && !target.fainted) {
					possibleTargets.push(target);
				}
			}
			while (possibleTargets.length) {
				const rand = this.random(possibleTargets.length);
				const target = possibleTargets[rand];
				let possibleAbilities = [target.ability];
				if (target.m.innates) possibleAbilities.push(...target.m.innates);
				const additionalBannedAbilities = [
					// Zen Mode included here for compatability with Gen 5-6
					'noability', 'flowergift', 'forecast', 'hungerswitch', 'illusion', 'imposter', 'neutralizinggas', 'powerofalchemy', 'receiver', 'trace', 'zenmode', pokemon.ability, ...(pokemon.m.innates || []),
				];
				possibleAbilities = possibleAbilities
					.filter(val => !this.dex.abilities.get(val).isPermanent && !additionalBannedAbilities.includes(val));
				if (!possibleAbilities.length) {
					possibleTargets.splice(rand, 1);
					continue;
				}
				const ability = this.dex.abilities.get(this.sample(possibleAbilities));
				this.add('-ability', pokemon, ability, '[from] ability: Trace', '[of] ' + target);
				if (isAbility) {
					pokemon.setAbility(ability);
				} else {
					pokemon.removeVolatile("ability:trace");
					pokemon.addVolatile("ability:" + ability, pokemon);
				}
				return;
			}
		},
	},
	wanderingspirit: {
		inherit: true,
		onDamagingHit(damage, target, source, move) {
			const isAbility = target.ability === 'wanderingspirit';
			const additionalBannedAbilities = ['hungerswitch', 'illusion', 'neutralizinggas', 'wonderguard'];
			if (isAbility) {
				if (source.getAbility().isPermanent || additionalBannedAbilities.includes(source.ability) ||
					target.volatiles['dynamax']
				) {
					return;
				}

				if (move.flags['contact']) {
					const sourceAbility = source.setAbility('wanderingspirit', target);
					if (!sourceAbility) return;
					if (target.isAlly(source)) {
						this.add('-activate', target, 'Skill Swap', '', '', '[of] ' + source);
					} else {
						this.add('-activate', target, 'ability: Wandering Spirit', this.dex.abilities.get(sourceAbility).name, 'Wandering Spirit', '[of] ' + source);
					}
					target.setAbility(sourceAbility);
				}
			} else {
				// Make Wandering Spirit replace a random ability
				const possibleAbilities = [source.ability, ...(source.m.innates || [])]
					.filter(val => !this.dex.abilities.get(val).isPermanent && !additionalBannedAbilities.includes(val));
				if (!possibleAbilities.length || target.volatiles['dynamax']) return;
				if (move.flags['contact']) {
					const sourceAbility = this.sample(possibleAbilities);
					if (sourceAbility === source.ability) {
						if (!source.setAbility('wanderingspirit', target)) return;
					} else {
						source.removeVolatile('ability:' + sourceAbility);
						source.addVolatile('ability:wanderingspirit', source);
					}
					if (target.isAlly(source)) {
						this.add('-activate', target, 'Skill Swap', '', '', '[of] ' + source);
					} else {
						this.add('-activate', target, 'ability: Wandering Spirit', this.dex.abilities.get(sourceAbility).name, 'Wandering Spirit', '[of] ' + source);
					}
					if (sourceAbility === source.ability) {
						target.setAbility(sourceAbility);
					} else {
						target.removeVolatile('ability:wanderingspirit');
						target.addVolatile('ability:' + sourceAbility, target);
					}
				}
			}
		},
	},
};
