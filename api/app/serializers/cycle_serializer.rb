# == Schema Information
#
# Table name: cycles
#
#  id         :uuid             not null, primary key
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :uuid             not null
#
# Indexes
#
#  index_cycles_on_user_id  (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#
class CycleSerializer < ActiveModel::Serializer
  attributes :id

  has_one :user
  has_many :days
end
