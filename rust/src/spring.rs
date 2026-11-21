#[derive(Clone, Copy)]
pub struct Spring {
    pub position: f32,
    pub velocity: f32,
    pub target: f32,
}

impl Spring {
    pub const fn new(initial_value: f32) -> Self {
        Self {
            position: initial_value,
            velocity: 0.0,
            target: initial_value,
        }
    }

    pub fn snap(&mut self, target_value: f32) {
        self.position = target_value;
        self.velocity = 0.0;
        self.target = target_value;
    }

    pub fn step(&mut self, delta_seconds: f32, stiffness: f32, damping: f32) {
        let clamped_delta = delta_seconds.clamp(0.0, 0.05);
        let substep_delta = clamped_delta * 0.5;
        for _ in 0..2 {
            let displacement = self.target - self.position;
            let force = displacement * stiffness - self.velocity * damping;
            self.velocity += force * substep_delta;
            self.position += self.velocity * substep_delta;
        }
    }
}
