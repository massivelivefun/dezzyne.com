use std::f32::consts::TAU;

use glam::{Vec2, Vec3};
use rand::rngs::SmallRng;
use rand::{RngExt, SeedableRng};

use crate::grid::GridCamera;
use crate::spring::Spring;

pub const PORTAL_FLOATS: usize = 12;
pub const RINGS_PER_PORTAL: usize = 4;
pub const RING_FLOATS_PER_PORTAL: usize = RINGS_PER_PORTAL * 2;
pub const PARTICLES_PER_PORTAL: usize = 56;
pub const PARTICLE_FLOATS: usize = 8;
pub const METADATA_U32S_PER_PORTAL: usize = 4;

pub const DEFAULT_PORTAL_SCALE: f32 = 1.25;
pub const PORTAL_CENTER_HEIGHT_Y: f32 = -0.613;

const PORTAL_HALF_WIDTH: f32 = 0.51;
const PORTAL_HALF_HEIGHT: f32 = 0.74;
const RING_DURATION_SECONDS: f32 = 0.58;

#[derive(Clone, Copy)]
pub struct PortalConfiguration {
    pub world_position: Vec3,
    pub scale: f32,
}

impl PortalConfiguration {
    pub const fn at(
        position_x: f32,
        position_y: f32,
        position_z: f32,
    ) -> Self {
        Self {
            world_position: Vec3::new(position_x, position_y, position_z),
            scale: DEFAULT_PORTAL_SCALE,
        }
    }

    #[allow(dead_code)]
    pub const fn with_scale(mut self, scale: f32) -> Self {
        self.scale = scale;
        self
    }
}

#[derive(Clone, Copy)]
struct Particle {
    angle: f32,
    radial_distance: f32,
    inward_speed: f32,
    radius_pixels: f32,
    color_shade: f32,
    twinkle_phase: f32,
    is_streak: bool,
}

impl Particle {
    const fn zero() -> Self {
        Self {
            angle: 0.0,
            radial_distance: 1.4,
            inward_speed: 0.3,
            radius_pixels: 3.0,
            color_shade: 0.0,
            twinkle_phase: 0.0,
            is_streak: false,
        }
    }
}

pub struct PortalEntity {
    configuration: PortalConfiguration,
    is_hovered: bool,
    elapsed_seconds: f32,
    pop_scale: Spring,
    instance_identifier: u32,
    player_count: u32,
    ring_ages: [f32; RINGS_PER_PORTAL],
    particles: [Particle; PARTICLES_PER_PORTAL],
    screen_center: Vec2,
    screen_radii: Vec2,
}

impl PortalEntity {
    pub fn from_prefab(
        configuration: PortalConfiguration,
        random_generator: &mut SmallRng,
    ) -> Self {
        let mut entity = Self {
            configuration,
            is_hovered: false,
            elapsed_seconds: 0.0,
            pop_scale: Spring::new(0.04),
            instance_identifier: random_generator
                .random_range(10_000..=99_999),
            player_count: random_generator.random_range(56..=74),
            ring_ages: [-1.0; RINGS_PER_PORTAL],
            particles: [Particle::zero(); PARTICLES_PER_PORTAL],
            screen_center: Vec2::ZERO,
            screen_radii: Vec2::ZERO,
        };
        entity.pop_scale.target = 1.0;
        entity.spawn_ring();
        for particle_index in 0..PARTICLES_PER_PORTAL {
            entity.spawn_particle(particle_index, true, random_generator);
        }
        entity
    }

    pub fn spawn_ring(&mut self) {
        let mut target_index: usize = 0;
        let mut oldest_age: f32 = -1.0;
        let mut found_free_slot = false;

        for ring_index in 0..RINGS_PER_PORTAL {
            if self.ring_ages[ring_index] < 0.0 {
                target_index = ring_index;
                found_free_slot = true;
                break;
            }
            if self.ring_ages[ring_index] > oldest_age {
                oldest_age = self.ring_ages[ring_index];
                target_index = ring_index;
            }
        }

        if found_free_slot || oldest_age >= 0.0 {
            self.ring_ages[target_index] = 0.0;
        }
    }

    fn spawn_particle(
        &mut self,
        particle_index: usize,
        initial_spread: bool,
        random_generator: &mut SmallRng,
    ) {
        let angle = random_generator.random_range(0.0..TAU);
        let is_streak = random_generator.random_bool(0.42);
        let minimum_initial_distance = if is_streak { 0.18 } else { 0.14 };
        let radial_distance = if initial_spread {
            random_generator.random_range(minimum_initial_distance..1.76)
        } else {
            random_generator.random_range(1.10..1.82)
        };

        let (inward_speed, radius_pixels) = if is_streak {
            (
                random_generator.random_range(0.54..0.84),
                random_generator.random_range(1.8..2.9),
            )
        } else {
            (
                random_generator.random_range(0.22..0.38),
                random_generator.random_range(2.5..4.6),
            )
        };

        let color_shade = random_generator.random_range(0.0..1.0);
        let twinkle_phase = random_generator.random_range(0.0..TAU);

        self.particles[particle_index] = Particle {
            angle,
            radial_distance,
            inward_speed,
            radius_pixels,
            color_shade,
            twinkle_phase,
            is_streak,
        };
    }

    pub fn hit_test(&self, screen_point: Vec2) -> bool {
        if self.screen_radii.x <= 1.0 || self.screen_radii.y <= 1.0 {
            return false;
        }
        let normalized_offset =
            (screen_point - self.screen_center) / self.screen_radii;
        normalized_offset.length_squared() <= 1.0
    }

    pub fn countdown_seconds(&self) -> u32 {
        if self.elapsed_seconds >= 30.0 {
            return 0;
        }
        let elapsed_whole = (self.elapsed_seconds.floor() as u32).min(30);
        30 - elapsed_whole
    }

    pub fn floor_anchor(&self) -> Vec2 {
        Vec2::new(
            self.configuration.world_position.x,
            self.configuration.world_position.z,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn step(
        &mut self,
        delta_seconds: f32,
        motion_scale: f32,
        global_time: f32,
        safe_viewport: Vec2,
        grid_camera: &GridCamera,
        random_generator: &mut SmallRng,
        portal_output: &mut [f32],
        ring_output: &mut [f32],
        particle_output: &mut [f32],
        metadata_output: &mut [u32],
    ) {
        self.elapsed_seconds =
            (self.elapsed_seconds + delta_seconds).min(3600.0);

        if motion_scale <= 0.001 {
            self.pop_scale.snap(1.0);
        } else {
            self.pop_scale.step(delta_seconds, 145.0, 17.5);
        }

        let portal_scale = self.configuration.scale;

        for ring_index in 0..RINGS_PER_PORTAL {
            let output_offset = ring_index * 2;
            ring_output[output_offset] = 0.0;
            ring_output[output_offset + 1] = 0.0;

            if motion_scale <= 0.001 {
                self.ring_ages[ring_index] = -1.0;
                continue;
            }
            let ring_age = self.ring_ages[ring_index];
            if ring_age < 0.0 {
                continue;
            }
            let next_age = ring_age + delta_seconds * motion_scale;
            if next_age >= RING_DURATION_SECONDS {
                self.ring_ages[ring_index] = -1.0;
                continue;
            }

            self.ring_ages[ring_index] = next_age;
            let progress = (next_age / RING_DURATION_SECONDS).clamp(0.0, 1.0);
            let remaining = 1.0 - progress;
            let eased_progress = 1.0 - remaining * remaining;
            let ring_radius = (0.16 + eased_progress * 1.12) * portal_scale;
            let fade_in_ramp = (progress * 10.0).clamp(0.0, 1.0);
            let ring_alpha = remaining * remaining * remaining * fade_in_ramp;
            ring_output[output_offset] = ring_radius;
            ring_output[output_offset + 1] = ring_alpha;
        }

        let (portal_center, projection_scale) = grid_camera
            .project_world_point(
                self.configuration.world_position,
                safe_viewport,
            );

        let pop_factor = self.pop_scale.position.clamp(0.0, 1.15);
        let maximum_radius_x = safe_viewport.x * (0.28 * portal_scale);
        let base_radius_x =
            (PORTAL_HALF_WIDTH * portal_scale * projection_scale)
                .min(maximum_radius_x);
        let base_radius_y =
            base_radius_x * (PORTAL_HALF_HEIGHT / PORTAL_HALF_WIDTH);
        let base_radii = Vec2::new(base_radius_x, base_radius_y);
        let portal_radii = base_radii * pop_factor;

        self.screen_center = portal_center;
        self.screen_radii = portal_radii;

        portal_output[0] = portal_center.x;
        portal_output[1] = portal_center.y;
        portal_output[2] = portal_radii.x;
        portal_output[3] = portal_radii.y;

        portal_output[4] = self.configuration.world_position.x;
        portal_output[5] = self.configuration.world_position.z;
        portal_output[6] = 1.0;
        portal_output[7] = self.configuration.world_position.y;

        portal_output[8] = global_time;
        portal_output[9] = pop_factor.clamp(0.0, 1.0);
        portal_output[10] = portal_scale;
        portal_output[11] = 0.0;

        for particle_index in 0..PARTICLES_PER_PORTAL {
            let mut particle = self.particles[particle_index];
            let acceleration = if particle.is_streak {
                0.65 + 0.60 / (particle.radial_distance + 0.30)
            } else {
                0.55 + 0.32 / (particle.radial_distance + 0.36)
            };
            let inward_pull = particle.inward_speed * acceleration;
            particle.radial_distance -=
                inward_pull * delta_seconds * motion_scale;

            let minimum_distance = if particle.is_streak {
                0.14
            } else {
                0.06
            };
            if particle.radial_distance <= minimum_distance {
                self.spawn_particle(particle_index, false, random_generator);
                particle = self.particles[particle_index];
            } else {
                self.particles[particle_index] = particle;
            }

            let radial_vector = Vec2::from_angle(particle.angle) * base_radii;
            let screen_position =
                portal_center + radial_vector * particle.radial_distance;
            let inward_direction = (-radial_vector).normalize_or_zero();

            let fade_in =
                ((1.82 - particle.radial_distance) / 0.44).clamp(0.0, 1.0);
            let (fade_out, streak_taper) = if particle.is_streak {
                let linear_fade =
                    ((particle.radial_distance - 0.14) / 0.32).clamp(0.0, 1.0);
                (
                    linear_fade * (0.45 + 0.55 * linear_fade),
                    linear_fade.sqrt(),
                )
            } else {
                (
                    ((particle.radial_distance - 0.06) / 0.30).clamp(0.0, 1.0),
                    1.0,
                )
            };

            let twinkle_factor = if particle.is_streak {
                0.96
            } else {
                let twinkle_argument =
                    global_time * 4.2 + particle.twinkle_phase * 3.0;
                0.80 + 0.20 * twinkle_argument.sin()
            };
            let clamped_pop = pop_factor.clamp(0.0, 1.0);
            let particle_alpha =
                fade_in * fade_out * twinkle_factor * clamped_pop;

            let (stretch_factor, tint_code) = if particle.is_streak {
                let warp_boost =
                    (1.35 / (particle.radial_distance + 0.30)).clamp(0.0, 2.6);
                let tapered_motion =
                    motion_scale.clamp(0.0, 1.0) * streak_taper;
                let streak_length = 1.0 + (3.6 + warp_boost) * tapered_motion;
                (streak_length, 1.0 + particle.color_shade)
            } else {
                (1.0, particle.color_shade * 0.45)
            };

            let output_offset = particle_index * PARTICLE_FLOATS;
            particle_output[output_offset] = screen_position.x;
            particle_output[output_offset + 1] = screen_position.y;
            particle_output[output_offset + 2] = inward_direction.x;
            particle_output[output_offset + 3] = inward_direction.y;
            particle_output[output_offset + 4] =
                particle.radius_pixels * portal_scale;
            particle_output[output_offset + 5] = stretch_factor;
            particle_output[output_offset + 6] = particle_alpha;
            particle_output[output_offset + 7] = tint_code;
        }

        metadata_output[0] = self.instance_identifier;
        metadata_output[1] = self.player_count;
        metadata_output[2] = self.countdown_seconds();
        metadata_output[3] = u32::from(self.is_hovered);
    }
}

pub struct PortalGroup {
    random_generator: SmallRng,
    entities: Vec<PortalEntity>,
    hovered_index: Option<usize>,
    portals_buffer: Vec<f32>,
    rings_buffer: Vec<f32>,
    particles_buffer: Vec<f32>,
    metadata_buffer: Vec<u32>,
}

impl PortalGroup {
    pub fn new() -> Self {
        Self {
            random_generator: SmallRng::seed_from_u64(0x9e37_79b9_7f4a_7c15),
            entities: Vec::new(),
            hovered_index: None,
            portals_buffer: Vec::new(),
            rings_buffer: Vec::new(),
            particles_buffer: Vec::new(),
            metadata_buffer: Vec::new(),
        }
    }

    pub fn spawn_prefabs(
        &mut self,
        prefabs: &[PortalConfiguration],
        random_seed: u32,
    ) {
        self.random_generator =
            SmallRng::seed_from_u64(u64::from(random_seed));
        self.hovered_index = None;
        self.entities.clear();

        let mut sorted_prefabs = prefabs.to_vec();
        sorted_prefabs.sort_by(|first, second| {
            second
                .world_position
                .z
                .partial_cmp(&first.world_position.z)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        self.entities.reserve(sorted_prefabs.len());
        for configuration in sorted_prefabs {
            self.entities.push(PortalEntity::from_prefab(
                configuration,
                &mut self.random_generator,
            ));
        }

        let entity_count = self.entities.len();
        self.portals_buffer.assign_length(entity_count * PORTAL_FLOATS);
        self.rings_buffer
            .assign_length(entity_count * RING_FLOATS_PER_PORTAL);
        self.particles_buffer.assign_length(
            entity_count * PARTICLES_PER_PORTAL * PARTICLE_FLOATS,
        );
        self.metadata_buffer
            .assign_length(entity_count * METADATA_U32S_PER_PORTAL);
    }

    pub fn initialize_ugce_trio(
        &mut self,
        is_enabled: bool,
        random_seed: u32,
    ) {
        if !is_enabled {
            self.spawn_prefabs(&[], random_seed);
            return;
        }
        let trio = [
            PortalConfiguration::at(-2.75, PORTAL_CENTER_HEIGHT_Y, 5.45),
            PortalConfiguration::at(2.75, PORTAL_CENTER_HEIGHT_Y, 5.45),
            PortalConfiguration::at(0.0, PORTAL_CENTER_HEIGHT_Y, 4.35),
        ];
        self.spawn_prefabs(&trio, random_seed);
    }

    pub fn clear_hover(&mut self) {
        self.hovered_index = None;
        for entity in &mut self.entities {
            entity.is_hovered = false;
        }
    }

    pub fn hit_test(&self, screen_point: Vec2) -> Option<usize> {
        for entity_index in (0..self.entities.len()).rev() {
            if self.entities[entity_index].hit_test(screen_point) {
                return Some(entity_index);
            }
        }
        None
    }

    pub fn click(&self, screen_point: Vec2) -> Option<usize> {
        self.hit_test(screen_point)
    }

    pub fn step(
        &mut self,
        delta_seconds: f32,
        motion_scale: f32,
        global_time: f32,
        viewport_size: Vec2,
        pointer_position: Vec2,
        pointer_active: bool,
        grid_camera: &GridCamera,
    ) {
        if self.entities.is_empty() {
            self.hovered_index = None;
            return;
        }

        let safe_viewport = viewport_size.max(Vec2::ONE);

        for (entity_index, entity) in self.entities.iter_mut().enumerate() {
            let portal_start = entity_index * PORTAL_FLOATS;
            let ring_start = entity_index * RING_FLOATS_PER_PORTAL;
            let particle_span = PARTICLES_PER_PORTAL * PARTICLE_FLOATS;
            let particle_start = entity_index * particle_span;
            let metadata_start = entity_index * METADATA_U32S_PER_PORTAL;
            let metadata_end = metadata_start + METADATA_U32S_PER_PORTAL;

            entity.step(
                delta_seconds,
                motion_scale,
                global_time,
                safe_viewport,
                grid_camera,
                &mut self.random_generator,
                &mut self.portals_buffer
                    [portal_start..portal_start + PORTAL_FLOATS],
                &mut self.rings_buffer
                    [ring_start..ring_start + RING_FLOATS_PER_PORTAL],
                &mut self.particles_buffer
                    [particle_start..particle_start + particle_span],
                &mut self.metadata_buffer[metadata_start..metadata_end],
            );
        }

        let hovered_match = if pointer_active {
            self.hit_test(pointer_position)
        } else {
            None
        };
        self.hovered_index = hovered_match;

        for (entity_index, entity) in self.entities.iter_mut().enumerate() {
            let is_hovered = hovered_match == Some(entity_index);
            entity.is_hovered = is_hovered;
            self.metadata_buffer
                [entity_index * METADATA_U32S_PER_PORTAL + 3] =
                u32::from(is_hovered);
        }
    }

    pub fn is_any_hovered(&self) -> bool {
        self.hovered_index.is_some()
    }

    pub fn hovered_floor_anchor(&self) -> Option<Vec2> {
        let hovered_index = self.hovered_index?;
        self.entities.get(hovered_index).map(PortalEntity::floor_anchor)
    }

    pub fn portal_count(&self) -> usize {
        self.entities.len()
    }

    pub fn total_particle_count(&self) -> usize {
        self.entities.len() * PARTICLES_PER_PORTAL
    }

    pub fn portals_pointer(&self) -> *const f32 {
        self.portals_buffer.as_ptr()
    }

    pub fn rings_pointer(&self) -> *const f32 {
        self.rings_buffer.as_ptr()
    }

    pub fn particles_pointer(&self) -> *const f32 {
        self.particles_buffer.as_ptr()
    }

    pub fn metadata_pointer(&self) -> *const u32 {
        self.metadata_buffer.as_ptr()
    }
}

trait VectorAssignLength<T> {
    fn assign_length(&mut self, length: usize);
}

impl<T: Copy + Default> VectorAssignLength<T> for Vec<T> {
    fn assign_length(&mut self, length: usize) {
        self.clear();
        self.resize(length, T::default());
    }
}
