# == Schema Information
#
# Table name: category_levels
#
#  id          :uuid             not null, primary key
#  icon        :string
#  name        :string
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  category_id :uuid             not null
#
# Indexes
#
#  index_category_levels_on_category_id  (category_id)
#
# Foreign Keys
#
#  fk_rails_...  (category_id => categories.id)
#
require 'rails_helper'

RSpec.describe CategoryLevel, type: :model do
  pending "add some examples to (or delete) #{__FILE__}"
end
