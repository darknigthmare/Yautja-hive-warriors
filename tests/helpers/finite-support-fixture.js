/** Geometry/weapon fixtures use an explicitly allowed, unobstructed scenario.
 * Closed/unknown roofs and finite resources have separate integration tests. */
export function configureSupportFixture(support) {
  support.beginMission({ missionId: 'headless-open-support-fixture', allowed: true, factionId: 'player_clan', canAccessAir: () => true });
  return support;
}
