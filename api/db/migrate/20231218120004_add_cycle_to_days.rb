class AddCycleToDays < ActiveRecord::Migration[7.0]
  def change
    add_reference :days, :cycle, type: :uuid, null: false, foreign_key: true
  end
end
